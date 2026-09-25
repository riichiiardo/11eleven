/**
 * 11Eleven — Leagues (multi-tournament).
 *
 * A user can CREATE any number of leagues (becoming their Administrador
 * principal and immediately landing on the rules step) or JOIN an existing one
 * with its code. One league is "active" at a time (`users.activeTournamentId`)
 * and every tournament-scoped query in the app resolves through it.
 *
 * Teams come from the GLOBAL `teamCatalog` (SoFIFA). Choosing a team inside a
 * league instantiates a `clubs` row scoped to that league with an EMPTY squad:
 * players are only acquired in the draft, never imported with the club.
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { LeagueSummaryView } from "./appTypes";
import {
  logAudit,
  loadAdmin,
  loadPresident,
  toTournamentView,
  WEEK_MS,
} from "./context";
import { DEFAULT_RULES } from "./rulesEngine";
import { PERMISSIONS } from "./schema";
import { seedTeamCatalogFallback } from "./tournament";

/** Maximum squads allowed per league — protects the draft/competition engines. */
export const MAX_TEAMS_PER_LEAGUE = 24;

function randomCode(length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function codeFor(name: string): string {
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 6);
  return clean.length >= 4 ? clean : "LIGA";
}

/* ------------------------------------------------------------------ *
 * Queries
 * ------------------------------------------------------------------ */

/** Every league the caller belongs to (member, president or admin). */
export const myLeagues = query({
  args: {},
  handler: async (ctx): Promise<LeagueSummaryView[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    const activeId = user?.activeTournamentId ?? null;

    const memberships = await ctx.db
      .query("leagueMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const views: LeagueSummaryView[] = [];
    for (const membership of memberships) {
      const tournament = await ctx.db.get(membership.tournamentId);
      if (!tournament) continue;
      const president = await loadPresident(ctx, tournament._id, userId);
      const admin = await loadAdmin(ctx, tournament._id, userId);
      const members = await ctx.db
        .query("leagueMembers")
        .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
        .collect();
      let clubName: string | null = null;
      if (president) {
        const club = await ctx.db.get(president.clubId);
        clubName = club?.name ?? null;
      }
      views.push({
        id: tournament._id,
        code: tournament.code,
        name: tournament.name,
        season: tournament.season,
        memberCount: members.length,
        isAdmin: Boolean(admin) || membership.role === "administrador",
        myClubName: clubName,
        active: tournament._id === activeId,
        createdAt: tournament.createdAt,
      });
    }

    return views.sort((a, b) =>
      a.active === b.active ? b.createdAt - a.createdAt : a.active ? -1 : 1,
    );
  },
});

/**
 * Teams available to pick inside the ACTIVE league: every teamCatalog entry
 * marked with whether it is still free there. Global catalogue, league-scoped
 * availability.
 */
export const teamCatalogForMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    const activeId = user?.activeTournamentId;
    if (!activeId) return null;

    const teams = await ctx.db.query("teamCatalog").collect();
    const clubs = await ctx.db
      .query("clubs")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", activeId))
      .collect();
    const takenByCatalog = new Map<string, Id<"clubs">>();
    for (const club of clubs) {
      if (club.catalogTeamId) {
        takenByCatalog.set(club.catalogTeamId, club._id);
      }
    }

    const presidents = await ctx.db
      .query("presidents")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", activeId))
      .collect();
    const ownerByClub = new Map(
      presidents.map((president) => [president.clubId as string, president.userId]),
    );

    return teams
      .map((team) => {
        const clubId = takenByCatalog.get(team._id) ?? null;
        return {
          id: team._id,
          name: team.name,
          league: team.league,
          country: team.country,
          colors: [team.colorPrimary, team.colorSecondary] as [string, string],
          clubId,
          takenByMe: clubId !== null && ownerByClub.get(clubId) === userId,
          takenByOther:
            clubId !== null && ownerByClub.get(clubId) !== undefined &&
            ownerByClub.get(clubId) !== userId,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/* ------------------------------------------------------------------ *
 * Mutations
 * ------------------------------------------------------------------ */

/**
 * Creates a league. The creator becomes Administrador principal + member and
 * the league is activated immediately: the next step in the UI is configuring
 * its rules (the createLeague flow opens the rules panel).
 */
export const createLeague = mutation({
  args: {
    name: v.string(),
    season: v.optional(v.string()),
    budget: v.optional(v.number()),
    squadSize: v.optional(v.number()),
  },
  handler: async (ctx, { name, season, budget, squadSize }) => {
    const userId = requireAuth(await getAuthUserId(ctx));
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("No se encontró tu cuenta.");

    const cleanName = name.trim();
    if (cleanName.length < 3 || cleanName.length > 60) {
      throw new ConvexError(
        "El nombre de la liga debe tener entre 3 y 60 caracteres.",
      );
    }

    const now = Date.now();
    const seasonLabel = season?.trim() || "2026 / 2027";

    // Unique short code: name prefix + random suffix, retried on collision.
    let code = `${codeFor(cleanName)}-${randomCode(4)}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const clash = await ctx.db
        .query("tournaments")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      if (!clash) break;
      code = `${codeFor(cleanName)}-${randomCode(4)}`;
    }

    const tournamentId = await ctx.db.insert("tournaments", {
      code,
      name: cleanName,
      season: seasonLabel,
      status: "configuracion",
      currentMatchday: 1,
      totalMatchdays: 38,
      marketOpen: false,
      nextMatchdayAt: now + WEEK_MS,
      ownerUserId: userId,
      createdAt: now,
    });

    await ctx.db.insert("tournamentRules", {
      tournamentId,
      ...DEFAULT_RULES,
      budget: budget ?? DEFAULT_RULES.budget,
      squadSize: squadSize ?? DEFAULT_RULES.squadSize,
      updatedAt: now,
      updatedBy: userId,
    });

    await ctx.db.insert("tournamentAdmins", {
      tournamentId,
      userId,
      role: "principal",
      permissions: [...PERMISSIONS],
      createdAt: now,
    });

    await ctx.db.insert("leagueMembers", {
      tournamentId,
      userId,
      role: "administrador",
      joinedAt: now,
    });

    // A new league must always have teams to pick: seed the global catalogue
    // when this deployment has none yet (idempotent, never duplicates).
    if (!(await ctx.db.query("teamCatalog").first())) {
      await seedTeamCatalogFallback(ctx);
    }

    await ctx.db.patch(userId, { activeTournamentId: tournamentId });

    await logAudit(ctx, {
      tournamentId,
      actorUserId: userId,
      actorName: user.name?.trim() || "Presidente",
      action: "Liga creada",
      entity: "tournament",
      entityId: tournamentId,
      detail: `${cleanName} (${seasonLabel}) · código de invitación ${code} · el creador es Administrador principal`,
    });

    return { tournamentId, code, name: cleanName };
  },
});

/** Joins an existing league by its invitation code. */
export const joinLeague = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = requireAuth(await getAuthUserId(ctx));
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("No se encontró tu cuenta.");

    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length < 4) {
      throw new ConvexError(
        "Introduce el código de invitación completo que te compartió el Administrador.",
      );
    }

    const tournament = await ctx.db
      .query("tournaments")
      .withIndex("by_code", (q) => q.eq("code", cleanCode))
      .first();
    if (!tournament) {
      throw new ConvexError(
        `No existe ninguna liga con el código ${cleanCode}. Revisa mayúsculas y guiones.`,
      );
    }
    if (tournament.status === "cancelado") {
      throw new ConvexError("Esa liga fue cancelada por su Administración.");
    }

    const memberships = await ctx.db
      .query("leagueMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const existing = memberships.find(
      (row) => row.tournamentId === tournament._id,
    );

    const now = Date.now();
    if (!existing) {
      const alreadyAdmin = Boolean(await loadAdmin(ctx, tournament._id, userId));
      await ctx.db.insert("leagueMembers", {
        tournamentId: tournament._id,
        userId,
        role: alreadyAdmin ? "administrador" : "presidente",
        joinedAt: now,
      });
      await logAudit(ctx, {
        tournamentId: tournament._id,
        actorUserId: userId,
        actorName: user.name?.trim() || "Presidente",
        action: "Presidente se unió a la liga",
        entity: "leagueMember",
        detail: `${user.name?.trim() || "Un nuevo Presidente"} entró en ${tournament.name} con el código ${cleanCode}`,
      });
    }

    await ctx.db.patch(userId, { activeTournamentId: tournament._id });
    return { tournamentId: tournament._id, name: tournament.name };
  },
});

/** Switches the active league. Membership is required (admins are members too). */
export const activateLeague = mutation({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx, { tournamentId }) => {
    const userId = requireAuth(await getAuthUserId(ctx));
    const tournament = await ctx.db.get(tournamentId);
    if (!tournament) throw new ConvexError("La liga ya no existe.");

    const memberships = await ctx.db
      .query("leagueMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const isMember = memberships.some(
      (row) => row.tournamentId === tournamentId,
    );
    if (!isMember) {
      throw new ConvexError(
        "No eres miembro de esa liga. Únete con su código de invitación.",
      );
    }

    await ctx.db.patch(userId, { activeTournamentId: tournamentId });
    return { tournamentId, name: tournament.name };
  },
});

function requireAuth(userId: Id<"users"> | null): Id<"users"> {
  if (!userId) {
    throw new ConvexError("Necesitas iniciar sesión para gestionar tus ligas.");
  }
  return userId;
}

/* ------------------------------------------------------------------ *
 * Team instantiation lives in `tournament.chooseCatalogTeam`: the global
 * catalogue (teamCatalog) is instantiated as a league-scoped club with an
 * EMPTY squad, ready for the draft.
 * ------------------------------------------------------------------ */

/** League state for the switcher: active league name + code. */
export const activeLeague = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    const activeId = user?.activeTournamentId;
    if (!activeId) return null;
    const tournament = await ctx.db.get(activeId);
    if (!tournament) return null;
    const view = toTournamentView(tournament);
    return { id: view.id, name: view.name, code: view.code, season: view.season };
  },
});
