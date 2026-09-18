/**
 * 11Eleven — SoFIFA integration (fetch layer).
 *
 * "use node": SoFIFA's public JSON API (`/api/players?T=<teamId>` /
 * `?league=<id>&offset=<n>`) is consumed here with axios. Responses are mapped
 * defensively across the field names the endpoint has used over time
 * (`ovr|overall|rating`, `value|value_eur`, `nat|nationality`, …) so a schema
 * tweak on their side degrades gracefully instead of crashing the sync.
 *
 * SoFIFA sits behind Cloudflare: datacenter IPs often get a 403 interstitial.
 * The sync action in `footballSync.ts` catches that case and falls back to the
 * versioned snapshot catalogue, surfacing a human reason to Administration.
 */

"use node";

import axios from "axios";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { FC_VERSION, type Position } from "./rulesEngine";

export const SYNC_SOURCE = "SoFIFA";
/** English Premier League on SoFIFA; the sync accepts any league id. */
export const DEFAULT_LEAGUE_ID = 13;
export const MAX_PAGES = 30;
export const PAGE_STEP = 60;

const BASE = "https://sofifa.com";
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
} as const;

export type FetchedPlayer = {
  name: string;
  position: Position;
  ovr: number;
  age: number;
  value: number;
  nationality: string;
  flag: string;
  /** Team name as SoFIFA reports it; normalized later against the tournament. */
  realClub: string;
  realLeague: string;
};

export type FetchResult = {
  players: FetchedPlayer[];
  source: string;
  pages: number;
  note: string | null;
};

const POSITION_MAP: Array<[string, Position]> = [
  ["GK", "POR"],
  ["CB", "DFC"],
  ["LCB", "DFC"],
  ["RCB", "DFC"],
  ["LB", "LI"],
  ["LWB", "LI"],
  ["RB", "LD"],
  ["RWB", "LD"],
  ["CDM", "MCD"],
  ["LDM", "MCD"],
  ["RDM", "MCD"],
  ["CM", "MC"],
  ["LCM", "MC"],
  ["RCM", "MC"],
  ["CAM", "MCO"],
  ["LAM", "MCO"],
  ["RAM", "MCO"],
  ["LW", "EI"],
  ["LM", "EI"],
  ["RW", "ED"],
  ["RM", "ED"],
  ["CF", "DC"],
  ["ST", "DC"],
];

export function positionFrom(raw: unknown): Position | null {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  const first = raw.split(",")[0]?.trim().toUpperCase() ?? "";
  for (const [code, mapped] of POSITION_MAP) {
    if (first === code || first.startsWith(code)) return mapped;
  }
  return null;
}

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[^\d.]/g, ""));
      if (Number.isFinite(parsed) && value.trim().length > 0) return parsed;
    }
  }
  return null;
}

function flagFrom(raw: string): string {
  const emoji = raw.match(/\p{Extended_Pictographic}/u);
  return emoji?.[0] ?? "🏳️";
}

export function parsePlayerRow(
  row: Record<string, unknown>,
  leagueFallback: string,
): FetchedPlayer | null {
  const name = pickString(row, ["name", "player", "long_name", "fullName", "playerName"]);
  if (!name) return null;
  const ovr = pickNumber(row, ["ovr", "overall", "rating", "rating_avg"]);
  if (ovr === null || ovr < 40 || ovr > 99) return null;
  const position = positionFrom(
    pickString(row, ["position", "positions", "best_position", "role"]),
  );
  if (!position) return null;

  const nationality =
    pickString(row, ["nationality", "nation", "nat", "country"]) ?? "";
  const value = pickNumber(row, ["value", "value_eur", "valueEur", "market_value"]) ?? 0;

  return {
    name,
    position,
    ovr: Math.round(ovr),
    age: Math.max(15, Math.min(45, Math.round(pickNumber(row, ["age", "age_years"]) ?? 0))),
    value: Math.max(0, Math.round(value)),
    nationality,
    flag: flagFrom(nationality),
    realClub: pickString(row, ["team", "team_name", "teamName", "club"]) ?? "",
    realLeague: pickString(row, ["league", "league_name", "competition"]) ?? leagueFallback,
  };
}

function rowsOf(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of ["players", "data", "results", "items"]) {
      const inner = record[key];
      if (Array.isArray(inner)) return inner as Record<string, unknown>[];
    }
  }
  return [];
}

function urlFor(params: {
  teamId?: number;
  leagueId?: number;
  offset: number;
  r: string;
}): string {
  const query = new URLSearchParams({
    r: params.r,
    unit: "EUR",
    offset: String(params.offset),
  });
  if (typeof params.teamId === "number") query.set("T", String(params.teamId));
  if (typeof params.leagueId === "number") query.set("league", String(params.leagueId));
  return `${BASE}/api/players?${query.toString()}`;
}

async function fetchPage(url: string): Promise<Record<string, unknown>[]> {
  let response;
  try {
    response = await axios.get(url, {
      headers: BROWSER_HEADERS,
      timeout: 20_000,
      responseType: "json",
    });
  } catch (cause) {
    const status = axios.isAxiosError(cause) ? cause.response?.status : undefined;
    if (status === 403 || status === 503) {
      throw new ConvexError(
        "SoFIFA devolvió un bloqueo de Cloudflare (403) desde la IP del servidor. Usa el catálogo del snapshot o configura un proxy en la variable SOFIFA_PROXY_URL.",
      );
    }
    throw new ConvexError(
      `No se pudo contactar la API de SoFIFA${status ? ` (HTTP ${status})` : ""}. Reintentar más tarde suele bastar.`,
    );
  }
  return rowsOf(response.data);
}

/**
 * Pulls player rows from SoFIFA's JSON API. Team mode (`teamId`) and league
 * mode (`leagueId`) are both supported; pagination stops on the first page
 * without valid players or at MAX_PAGES.
 */
export const fetchPlayers = async (params: {
  teamId?: number;
  leagueId?: number;
  pages?: number;
  r?: string;
}): Promise<FetchResult> => {
  const r = params.r ?? "2700";
  const leagueFallback =
    typeof params.leagueId === "number" ? `Liga ${params.leagueId}` : "SoFIFA";
  const maxPages = Math.max(1, Math.min(params.pages ?? MAX_PAGES, MAX_PAGES));

  const players: FetchedPlayer[] = [];
  let pages = 0;
  for (let page = 0; page < maxPages; page += 1) {
    const rows = await fetchPage(
      urlFor({
        teamId: params.teamId,
        leagueId: params.leagueId,
        offset: page * PAGE_STEP,
        r,
      }),
    );
    let valid = 0;
    for (const row of rows) {
      const parsed = parsePlayerRow(row, leagueFallback);
      if (parsed) {
        players.push(parsed);
        valid += 1;
      }
    }
    pages += 1;
    if (valid === 0) break;
  }

  return {
    players,
    source: SYNC_SOURCE,
    pages,
    note: players.length === 0 ? "La respuesta no contenía jugadores válidos." : null,
  };
};

type SyncOutcome = {
  inserted: number;
  updated: number;
  unchanged: number;
  source: string;
  fcVersion: string;
  fallback: boolean;
  note: string | null;
};

/**
 * Administration entry point: pulls the latest ratings from SoFIFA and upserts
 * them into the versioned catalogue. Squads, ownership and budgets are never
 * touched — only the `players` table changes. When SoFIFA is unreachable
 * (typically a Cloudflare 403 from datacenter IPs) the action falls back to the
 * bundled snapshot so the tournament is always playable, and records why.
 *
 * Actions have no `ctx.db`: every database touch goes through the internal
 * query/mutations in `footballSync.ts`.
 */
export const syncCatalog = action({
  args: {
    teamId: v.optional(v.number()),
    leagueId: v.optional(v.number()),
    pages: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SyncOutcome> => {
    const { actorName } = await ctx.runQuery(
      internal.footballSync.assertCatalogAdmin,
      {},
    );

    try {
      const result = await fetchPlayers({
        teamId: args.teamId,
        leagueId: args.leagueId,
        pages: args.pages,
      });
      if (result.players.length === 0) {
        throw new ConvexError(
          result.note ?? "SoFIFA no devolvió jugadores para los filtros indicados.",
        );
      }
      const summary = await ctx.runMutation(internal.footballSync.applyCatalog, {
        players: result.players,
        fcVersion: FC_VERSION,
        source: SYNC_SOURCE,
      });
      return {
        inserted: summary.inserted,
        updated: summary.updated,
        unchanged: summary.unchanged,
        source: summary.source,
        fcVersion: summary.fcVersion,
        fallback: false,
        note: null,
      };
    } catch (cause) {
      const reason =
        cause instanceof ConvexError
          ? String(cause.message)
          : cause instanceof Error
            ? cause.message
            : "Error desconocido contactando SoFIFA.";

      await ctx.runMutation(internal.footballSync.logSyncFailure, {
        actorName,
        reason,
      });

      const fallback = await ctx.runMutation(internal.footballSync.applySnapshot, {
        actorName,
      });
      return {
        inserted: fallback.inserted,
        updated: fallback.updated,
        unchanged: fallback.unchanged,
        source: fallback.source,
        fcVersion: fallback.fcVersion,
        fallback: true,
        note: `SoFIFA no accesible: ${reason} Se aplicó el snapshot local como respaldo.`,
      };
    }
  },
});
