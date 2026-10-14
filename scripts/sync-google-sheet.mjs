#!/usr/bin/env node

import { readFileSync } from "node:fs";

const SHEET_ID = process.env.SHEET_ID || "1Rg-emaBHM2A51OB70erWPT3dbSPxsNaF";
const SHEET_GIDS = (process.env.SHEET_GIDS || Array.from({ length: 18 }, (_, i) => String(i + 1)).join(","))
  .split(",")
  .map((gid) => gid.trim())
  .filter(Boolean);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SOURCE = `google-sheet:${SHEET_ID}:all-tabs`;
const teamCrests = JSON.parse(readFileSync(new URL("../src/lib/team-crests.json", import.meta.url), "utf8"));
const publicAppUrl = (process.env.VITE_PUBLIC_APP_URL || "https://riichiiardo.github.io/11eleven").replace(/\/$/, "");
const CREST_URLS = Object.fromEntries(Object.entries(teamCrests).map(([name, entry]) => [name, `${publicAppUrl}/${entry.path}`]));

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorias.");
}

function csvRows(input) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function euros(value) {
  const digits = String(value ?? "").replace(/[^0-9-]/g, "");
  return digits ? Number(digits) : 0;
}

function position(value) {
  const valid = [
    "POR",
    "LD",
    "DFC",
    "LI",
    "MCD",
    "MC",
    "MCO",
    "ED",
    "EI",
    "DC",
  ];
  const found = String(value ?? "")
    .split(/\s+/)
    .find((part) => valid.includes(part));
  return found || "MC";
}

function group(pos) {
  if (pos === "POR") return "GK";
  if (["LD", "DFC", "LI"].includes(pos)) return "DEF";
  if (["MCD", "MC", "MCO"].includes(pos)) return "MID";
  return "FWD";
}

async function api(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!response.ok)
    throw new Error(
      `${path}: HTTP ${response.status} ${await response.text()}`,
    );
  return response.status === 204 ? [] : response.json();
}

const sheetRows = [];
for (const gid of SHEET_GIDS) {
  const csv = await (
    await fetch(
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`,
    )
  ).text();
  sheetRows.push({ gid, rows: csvRows(csv) });
}
const blocks = sheetRows.map(({ gid, rows }) => ({
  gid,
  rows,
  team: rows[0]?.find(Boolean)?.trim(),
})).filter(({ team, rows }) => team && rows[1]?.includes("Nombre"));
if (!blocks.length)
  throw new Error("No se encontraron bloques de equipos en la hoja.");

const teams = blocks.map(({ team }) => ({
  name: team.trim(),
  league: "Primera Liga",
  country: "",
  color_primary: "#334155",
  color_secondary: "#0f172a",
  crest_url: CREST_URLS[team.trim()] || null,
  source_key: `${SOURCE}:team:${team.trim()}`,
}));
const teamRows = await api("team_catalog?on_conflict=source_key", {
  method: "POST",
  body: JSON.stringify(teams),
  headers: { Prefer: "resolution=merge-duplicates,return=representation" },
});
if (teamRows.length !== teams.length) {
  throw new Error(
    `Supabase devolvió ${teamRows.length} equipos, se esperaban ${teams.length}.`,
  );
}
const existing = await api(
  "players?select=id,source_key,ovr,value,initial_value&source_key=not.is.null",
);
const previous = new Map(existing.map((player) => [player.source_key, player]));
const players = [];
for (const { team, rows } of blocks) {
  for (const row of rows.slice(2)) {
    const name = row[start];
    if (!name) continue;
    const pos = position(row[start + 3]);
    const value = euros(row[start + 1] || row[start + 2]);
    const key = `${SOURCE}:player:${team.trim()}:${name.trim()}`;
    const prior = previous.get(key);
    const initial = prior?.initial_value || euros(row[start + 1]) || value;
    players.push({
      name: name.trim(),
      position: pos,
      group: group(pos),
      ovr: Number(row[start + 4]) || 0,
      age: Number(row[start + 2]) || 0,
      value,
      initial_value: initial,
      nationality: row[start + 5] || "",
      flag: row[start + 6] || "",
      real_club: team.trim(),
      real_league: "Primera Liga",
      fc_version: "FC 27",
      source_key: key,
      source_updated_at: new Date().toISOString(),
    });
  }
}
await api("players?on_conflict=source_key", {
  method: "POST",
  body: JSON.stringify(players),
  headers: { Prefer: "resolution=merge-duplicates,return=representation" },
});
const current = await api(
  "players?select=id,source_key,ovr,value,initial_value&source_key=not.is.null",
);
const history = current.flatMap((player) => {
  const before = previous.get(player.source_key);
  if (!before || (before.ovr === player.ovr && before.value === player.value))
    return [];
  return [
    {
      player_id: player.id,
      source_key: player.source_key,
      ovr: player.ovr,
      value: player.value,
      initial_value: player.initial_value,
      ovr_delta: player.ovr - before.ovr,
      value_delta: player.value - before.value,
      source: SOURCE,
    },
  ];
});
if (history.length)
  await api("player_stat_history", {
    method: "POST",
    body: JSON.stringify(history),
  });
const bootstrapResponse = await fetch(
  `${SUPABASE_URL}/rest/v1/rpc/bootstrap_first_league`,
  {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  },
);
if (!bootstrapResponse.ok) {
  throw new Error(
    `bootstrap_first_league: HTTP ${bootstrapResponse.status} ${await bootstrapResponse.text()}`,
  );
}
console.log(
  JSON.stringify({
    source: SOURCE,
    teams: teams.length,
    players: players.length,
    changes: history.length,
  }),
);
