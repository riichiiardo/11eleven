#!/usr/bin/env node

const SHEET_ID = process.env.SHEET_ID || "1Rg-emaBHM2A51OB70erWPT3dbSPxsNaF";
const SHEET_GIDS = (process.env.SHEET_GIDS || Array.from({ length: 18 }, (_, i) => String(i + 1)).join(","))
  .split(",")
  .map((gid) => gid.trim())
  .filter(Boolean);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SOURCE = `google-sheet:${SHEET_ID}:all-tabs`;
const CREST_URLS = {
  "Manchester United": "https://paladarnegro.net/escudoteca/inglaterra/premier/img/manunited.jpg",
  "Fútbol Club Barcelona": "https://paladarnegro.net/escudoteca/espana/laliga/img/barcelona.jpg",
  "Palermo FC": "https://r2.thesportsdb.com/images/media/team/badge/zi1tb01579708939.png",
  "Arsenal Football Club": "https://paladarnegro.net/escudoteca/inglaterra/premier/img/arsenal.jpg",
  "Real Sociedad de Fútbol": "https://paladarnegro.net/escudoteca/espana/laliga/img/realsociedad.jpg",
  "Newcastle United Football Club": "https://paladarnegro.net/escudoteca/inglaterra/premier/img/newcastle.jpg",
  "París Saint-Germain Football Club": "https://paladarnegro.net/escudoteca/francia/ligue1/img/psg.jpg",
  "Racing Club": "https://paladarnegro.net/escudoteca/argentina/primeradivision/img/racing.jpg",
  "Sporting Clube de Portugal": "https://paladarnegro.net/escudoteca/portugal/primeiraliga/img/sporting.jpg",
  "Club Atlético de Madrid": "https://paladarnegro.net/escudoteca/espana/laliga/img/atlmadrid.jpg",
  "FC Porto": "https://paladarnegro.net/escudoteca/portugal/primeiraliga/img/porto.jpg",
  "Racing Club de Estrasburgo": "https://paladarnegro.net/escudoteca/francia/ligue1/img/racingestrasburgo.jpg",
  "Parma Calcio 1913": "https://paladarnegro.net/escudoteca/italia/seriea/img/parma.jpg",
  "Los Angeles Galaxy": "https://paladarnegro.net/escudoteca/estadosunidos/mls/img/losangelesgalaxy.jpg",
  "Bayer 04 Leverkusen": "https://paladarnegro.net/escudoteca/alemania/bundesliga/img/bayerleverkusen.jpg",
  "Club de Fútbol Cruz Azul": "https://paladarnegro.net/escudoteca/mexico/ligamx/img/cruzazul.jpg",
  "Leicester City Football Club": "https://r2.thesportsdb.com/images/media/team/badge/xtxwtu1448813356.png",
  "Club Deportivo Chivas de Guadalajara": "https://paladarnegro.net/escudoteca/mexico/ligamx/img/guadalajara.jpg",
};

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
