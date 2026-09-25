/**
 * 11Eleven — Catalogue synchronisation (SoFIFA → snapshot).
 *
 * The catalogue is the player universe the draft and the market draw from. It
 * is versioned (`fcVersion`), so a tournament always knows which database it
 * is playing with, and synchronising is IDEMPOTENT: importing the same
 * snapshot twice never duplicates players, and it never touches squads —
 * ownership lives in `squadPlayers`, which stays intact.
 *
 * This file has no Node runtime, so it hosts the query/mutation side; the
 * orchestrating action lives in `footballApi.ts` ("use node").
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getTournament, loadAdmin, seedFreeAgents, logAudit } from "./context";
import { FC_VERSION, type Position } from "./rulesEngine";

export const SYNCED_ACTION = "Catálogo sincronizado";
export const SYNC_FAILED_ACTION = "Sincronización de catálogo fallida";

/** Upsert row coming from the fetch layer. */
const catalogPlayerValidator = v.object({
  name: v.string(),
  position: v.string(),
  ovr: v.number(),
  age: v.number(),
  value: v.number(),
  nationality: v.string(),
  flag: v.string(),
  realClub: v.string(),
  realLeague: v.string(),
});

/**
 * Idempotent upsert of fetched players. Matching is by name (the catalogue's
 * stable identity); existing rows get their ratings refreshed, new rows are
 * inserted. Squad ownership is never touched.
 */
export const applyCatalog = internalMutation({
  args: {
    players: v.array(catalogPlayerValidator),
    fcVersion: v.string(),
    source: v.string(),
    /** The sync action applies the catalogue in chunks and logs once itself. */
    log: v.optional(v.boolean()),
  },
  handler: async (ctx, { players, fcVersion, source, log }) => {
    const tournament = await getTournament(ctx);
    if (!tournament) {
      throw new ConvexError("El torneo no está disponible.");
    }

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    for (const player of players) {
      const existing = await ctx.db
        .query("players")
        .withIndex("by_name", (q) => q.eq("name", player.name))
        .first();
      if (existing) {
        const changed =
          existing.ovr !== player.ovr ||
          existing.age !== player.age ||
          existing.value !== player.value ||
          existing.realClub !== player.realClub ||
          existing.realLeague !== player.realLeague ||
          existing.nationality !== player.nationality ||
          existing.flag !== player.flag ||
          existing.fcVersion !== fcVersion;
        if (changed) {
          await ctx.db.patch(existing._id, {
            ovr: player.ovr,
            age: player.age,
            value: player.value,
            nationality: player.nationality,
            flag: player.flag,
            realClub: player.realClub,
            realLeague: player.realLeague,
            fcVersion,
          });
          updated += 1;
        } else {
          unchanged += 1;
        }
        continue;
      }

      await ctx.db.insert("players", {
        name: player.name,
        position: player.position as Position,
        group: groupOfSafe(player.position),
        ovr: player.ovr,
        age: player.age,
        value: player.value,
        nationality: player.nationality,
        flag: player.flag,
        realClub: player.realClub,
        realLeague: player.realLeague,
        fcVersion,
      });
      inserted += 1;
    }

    const summary = {
      inserted,
      updated,
      unchanged,
      source,
      fcVersion,
      at: Date.now(),
    };
    if (log !== false) {
      await logAudit(ctx, {
        tournamentId: tournament._id,
        actorName: "Sistema",
        action: SYNCED_ACTION,
        entity: "catalog",
        entityId: JSON.stringify(summary),
        detail: `${source} (${fcVersion}): ${inserted} nuevos, ${updated} actualizados, ${unchanged} sin cambios · plantillas intactas`,
      });
    }

    return summary;
  },
});

/**
 * One audit entry per synchronisation call. The action imports the catalogue
 * in bounded chunks (each chunk stays silent) and reports the totals here, so
 * Administration sees the whole batch instead of a fragment per chunk.
 */
export const logSyncSuccess = internalMutation({
  args: {
    actorName: v.string(),
    source: v.string(),
    summary: v.object({
      inserted: v.number(),
      updated: v.number(),
      unchanged: v.number(),
      fcVersion: v.string(),
    }),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { actorName, source, summary, note }) => {
    const tournament = await getTournament(ctx);
    if (!tournament) return null;
    const payload = { ...summary, source, at: Date.now() };
    await logAudit(ctx, {
      tournamentId: tournament._id,
      actorName,
      action: SYNCED_ACTION,
      entity: "catalog",
      entityId: JSON.stringify(payload),
      detail: `${source} (${summary.fcVersion}): ${summary.inserted} nuevos, ${summary.updated} actualizados, ${summary.unchanged} sin cambios${note ? ` · ${note}` : " · plantillas intactas"}`,
    });
    return null;
  },
});

function groupOfSafe(position: string) {
  const first = position[0];
  if (first === "P") return "GK" as const;
  if (first === "D") return "DEF" as const;
  if (first === "M") return "MID" as const;
  return "FWD" as const;
}

/**
 * Fallback path: re-imports the versioned snapshot (free agents) bundled with
 * the app. Used when SoFIFA is unreachable (e.g. Cloudflare 403).
 */
export const applySnapshot = internalMutation({
  args: { actorName: v.string() },
  handler: async (ctx, { actorName }) => {
    const tournament = await getTournament(ctx);
    if (!tournament) {
      throw new ConvexError("El torneo no está disponible.");
    }
    const inserted = await seedFreeAgents(ctx, tournament._id);
    const total = (await ctx.db.query("players").collect()).length;
    const summary = {
      inserted,
      updated: 0,
      unchanged: total - inserted,
      source: "Snapshot local",
      fcVersion: FC_VERSION,
      at: Date.now(),
    };
    await logAudit(ctx, {
      tournamentId: tournament._id,
      actorName,
      action: SYNCED_ACTION,
      entity: "catalog",
      entityId: JSON.stringify(summary),
      detail: `Snapshot local (${FC_VERSION}): ${inserted} agentes libres incorporados · ${total} jugadores en el catálogo`,
    });
    return summary;
  },
});

/** Admin-facing wrapper for the snapshot fallback. */
export const runSnapshotSync = mutation({
  args: {},
  handler: async (ctx): Promise<CatalogSyncSummary> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Inicia sesión para sincronizar el catálogo.");
    const tournament = await getTournament(ctx);
    if (!tournament) throw new ConvexError("El torneo no está disponible.");
    const admin = await loadAdmin(ctx, tournament._id, userId);
    if (!admin) {
      throw new ConvexError("Solo Administración puede sincronizar el catálogo.");
    }
    const user = await ctx.db.get(userId);
    return await ctx.runMutation(internal.footballSync.applySnapshot, {
      actorName: user?.name ?? "Administración",
    });
  },
});

/**
 * Auth + permission gate for the sync action. Actions have no `ctx.db`, so the
 * action asks this internal query who is calling before spending network time.
 */
export const assertCatalogAdmin = internalQuery({
  args: {},
  handler: async (ctx): Promise<{ actorName: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Inicia sesión para sincronizar el catálogo.");
    const tournament = await getTournament(ctx);
    if (!tournament) throw new ConvexError("El torneo no está disponible.");
    const admin = await loadAdmin(ctx, tournament._id, userId);
    if (!admin) {
      throw new ConvexError("Solo Administración puede sincronizar el catálogo.");
    }
    const user = await ctx.db.get(userId);
    return { actorName: user?.name ?? "Administración" };
  },
});

/** Records why a SoFIFA attempt failed, for the Administration panel. */
export const logSyncFailure = internalMutation({
  args: { actorName: v.string(), reason: v.string() },
  handler: async (ctx, { actorName, reason }) => {
    const tournament = await getTournament(ctx);
    if (!tournament) return null;
    await logAudit(ctx, {
      tournamentId: tournament._id,
      actorName,
      action: SYNC_FAILED_ACTION,
      entity: "catalog",
      detail: reason.slice(0, 400),
    });
    return null;
  },
});

function parseSummary(entityId: string | undefined): {
  inserted: number;
  updated: number;
  unchanged: number;
  source: string;
  fcVersion: string;
  at: number;
} | null {
  if (!entityId) return null;
  try {
    const parsed = JSON.parse(entityId) as Record<string, unknown>;
    if (typeof parsed.at !== "number") return null;
    return {
      inserted: typeof parsed.inserted === "number" ? parsed.inserted : 0,
      updated: typeof parsed.updated === "number" ? parsed.updated : 0,
      unchanged: typeof parsed.unchanged === "number" ? parsed.unchanged : 0,
      source: typeof parsed.source === "string" ? parsed.source : "—",
      fcVersion: typeof parsed.fcVersion === "string" ? parsed.fcVersion : FC_VERSION,
      at: parsed.at,
    };
  } catch {
    return null;
  }
}

/** Catalogue status for the Administration panel. */
export const catalogState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const tournament = await getTournament(ctx);
    if (!tournament) return null;

    const rows = await ctx.db.query("players").collect();
    const owned = await ctx.db
      .query("squadPlayers")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
      .collect();
    const ownedIds = new Set(owned.map((row) => row.playerId as string));

    const audit = await ctx.db
      .query("auditLog")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
      .order("desc")
      .take(60);
    const lastSyncEntry =
      audit.find((entry) => entry.action === SYNCED_ACTION) ?? null;
    const lastErrorEntry =
      audit.find((entry) => entry.action === SYNC_FAILED_ACTION) ?? null;
    const lastSync = parseSummary(lastSyncEntry?.entityId);

    return {
      total: rows.length,
      // "Libre" = aún sin dueño en el torneo (criterio real de draft y mercado;
      // el club de origen SoFIFA del jugador no determina su disponibilidad).
      freeAgents: Math.max(0, rows.length - ownedIds.size),
      owned: ownedIds.size,
      version: lastSync?.fcVersion ?? FC_VERSION,
      lastSync,
      lastError:
        lastErrorEntry === null
          ? null
          : { at: lastErrorEntry.createdAt, message: lastErrorEntry.detail },
    };
  },
});

export type CatalogSyncSummary = {
  inserted: number;
  updated: number;
  unchanged: number;
  source: string;
  fcVersion: string;
  at: number;
};

export type CatalogStateView = {
  total: number;
  freeAgents: number;
  owned: number;
  version: string;
  lastSync: CatalogSyncSummary | null;
  lastError: { at: number; message: string } | null;
};
