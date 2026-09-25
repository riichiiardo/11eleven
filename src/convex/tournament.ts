import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { PERMISSIONS, adminRoleValidator, tournamentStatusValidator } from "./schema";
import type {
  AdminOverviewView,
  AppStateView,
  MarketSummaryView,
  NeedsLeagueState,
} from "./appTypes";
import {
  buildCompetitionSummary,
  seedFixtures,
} from "./competition";
import { CLUBS } from "./footballData";
import { loadDraftAdmin, loadDraftSummary } from "./draft";
import {
  buildActions,
  buildActivity,
  buildAdmins,
  buildClubViews,
  buildMyLeagues,
  buildNextEvent,
  buildOffers,
  buildPresidents,
  createSquadForClub,
  getTournament,
  loadAdmin,
  loadPresident,
  loadRules,
  loadSquadPlayers,
  loadTournamentOffers,
  logAudit,
  seedFreeAgents,
  seedTournament,
  toTournamentView,
} from "./context";import { DEFAULT_FORMATION,
  DEFAULT_RULES,
  FREE_AGENT_CLUB,
  LEGACY_SEEDED_RULES,
  computeSquadStats,
  evaluateLineup,
  evaluateSquadRules,
  formatMoney,
  isFormationCode,
  emptyLineup,
  type FormationCode,
  type Lineup,
  type PlayerAvailability,
} from "./rulesEngine";
import { COMMITTED_STATUSES, OPEN_STATUSES, type OfferStatus } from "./marketEngine";
import type { Id } from "./_generated/dataModel";

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function nicknameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "presidente";
  const clean = local.replace(/[^a-zA-Z0-9._-]/g, "");
  return `@${clean || "presidente"}`;
}

function emptyMarket(open: boolean): MarketSummaryView {
  return {
    open,
    freeAgents: 0,
    received: 0,
    sent: 0,
    reserved: 0,
    executed: 0,
    committedCash: 0,
  };
}

function requireAuth(userId: Id<"users"> | null): Id<"users"> {
  if (!userId) {
    throw new ConvexError(
      "Necesitas iniciar sesión para operar en el torneo.",
    );
  }
  return userId;
}

async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
  tournamentId: Id<"tournaments">,
  userId: Id<"users">,
  permission: string,
): Promise<void> {
  const admin = await loadAdmin(ctx, tournamentId, userId);
  if (!admin) {
    throw new ConvexError(
      "Esta acción requiere permisos de Administrador del torneo.",
    );
  }
  if (admin.role === "principal") return;
  if (!admin.permissions.includes(permission)) {
    throw new ConvexError(
      `Tu rol de Co-Administrador no incluye el permiso de ${permission}. Solicítalo al Administrador principal.`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * Bootstrap
 * ------------------------------------------------------------------ */

/**
 * Offline team fallback for the global catalogue: derived from the bundled
 * snapshot clubs so a fresh deployment always has teams to pick before any
 * SoFIFA sync runs. Idempotent seeding never modifies existing rows.
 */
const CATALOG_TEAM_FALLBACK = CLUBS.map((club) => ({
  name: club.name,
  league: club.league,
  country: club.country,
  colors: club.colors,
}));

/**
 * Idempotent bootstrap, multi-league aware. It NO LONGER auto-creates a
 * tournament: a user without a league gets `needsLeague` and the UI shows the
 * create/join gate (creating a league walks them through the rules step).
 * Existing deployments are migrated in place: their league gets membership rows
 * and the active-league pointer is back-filled.
 */
export const ensureSetup = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = requireAuth(await getAuthUserId(ctx));
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("No se encontró tu cuenta.");

    const displayName =
      user.name?.trim() ||
      nicknameFromEmail(user.email ?? "").replace("@", "") ||
      "Presidente";
    if (!user.name) {
      await ctx.db.patch(userId, { name: displayName });
    }

    const memberships = await ctx.db
      .query("leagueMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Already a member: make sure the active pointer exists and finish.
    if (memberships.length > 0) {
      const activeId = user.activeTournamentId;
      const activeValid =
        activeId && memberships.some((row) => row.tournamentId === activeId);
      if (!activeValid) {
        await ctx.db.patch(userId, {
          activeTournamentId: memberships[0].tournamentId,
        });
      }
      return {
        tournamentId: activeValid ? activeId : memberships[0].tournamentId,
      };
    }

    // Legacy migration: the user operated the pre-multi-league deployment (a
    // president or admin row exists) but has no membership yet.
    const presidentRows = await ctx.db
      .query("presidents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const adminRows = await ctx.db
      .query("tournamentAdmins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const legacyTournamentId =
      user.activeTournamentId ??
      presidentRows[0]?.tournamentId ??
      adminRows[0]?.tournamentId ??
      null;

    if (legacyTournamentId) {
      const tournament = await ctx.db.get(legacyTournamentId);
      if (tournament) {
        const alreadyAdmin = adminRows.some(
          (row) => row.tournamentId === legacyTournamentId,
        );
        await ctx.db.insert("leagueMembers", {
          tournamentId: legacyTournamentId,
          userId,
          role: alreadyAdmin ? "administrador" : "presidente",
          joinedAt: Date.now(),
        });
        // Free agents belong to the versioned snapshot and can be added to an
        // already seeded deployment without touching any squad.
        await seedFreeAgents(ctx, legacyTournamentId);
        await seedTeamCatalogFallback(ctx);
        await migrateSeededRules(
          ctx,
          legacyTournamentId,
          userId,
          displayName,
        );
        await seedFixtures(ctx, tournament);
        await ctx.db.patch(userId, { activeTournamentId: legacyTournamentId });
        return { tournamentId: legacyTournamentId };
      }
    }

    // Brand new user: no league anywhere. The UI gate takes it from here.
    return { needsLeague: true as const };
  },
});

/**
 * Ensures the global team catalogue has at least the bundled snapshot teams,
 * so a fresh deployment can pick teams even before any SoFIFA sync runs.
 * Idempotent: existing rows are never duplicated or modified.
 */
export async function seedTeamCatalogFallback(
  ctx: MutationCtx,
): Promise<number> {
  const existing = await ctx.db.query("teamCatalog").collect();
  const existingNames = new Set(existing.map((t) => t.name));
  let inserted = 0;
  for (const team of CATALOG_TEAM_FALLBACK) {
    if (existingNames.has(team.name)) continue;
    await ctx.db.insert("teamCatalog", {
      name: team.name,
      league: team.league,
      country: team.country,
      colorPrimary: team.colors[0],
      colorSecondary: team.colors[1],
    });
    inserted += 1;
  }
  return inserted;
}

/**
 * Self-heal for deployments whose global catalogue is empty (e.g. data left
 * over from earlier test runs, or a database wiped after the last seed).
 * Idempotent: it only writes when the table has no teams at all, and
 * `seedTeamCatalogFallback` never duplicates existing rows.
 */
export const ensureTeamCatalog = mutation({
  args: {},
  handler: async (ctx) => {
    requireAuth(await getAuthUserId(ctx));
    const existing = await ctx.db.query("teamCatalog").first();
    if (existing) return { inserted: 0 };
    const inserted = await seedTeamCatalogFallback(ctx);
    return { inserted };
  },
});

/**
 * Early deployments shipped a 20-player squad limit, before the market existed.
 * If the configuration is still the untouched seed and no operation has been
 * negotiated yet, it moves to the current rules so the market is usable.
 */
async function migrateSeededRules(
  ctx: MutationCtx,
  tournamentId: Id<"tournaments">,
  userId: Id<"users">,
  actorName: string,
): Promise<void> {
  const rulesDoc = await ctx.db
    .query("tournamentRules")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .first();
  if (!rulesDoc) return;

  const current = await loadRules(ctx, tournamentId);
  const isLegacy =
    JSON.stringify(current) === JSON.stringify(LEGACY_SEEDED_RULES);
  if (!isLegacy) return;

  const offers = await loadTournamentOffers(ctx, tournamentId);
  if (offers.length > 0) return;

  await ctx.db.patch(rulesDoc._id, {
    ...DEFAULT_RULES,
    updatedAt: Date.now(),
    updatedBy: userId,
  });
  await logAudit(ctx, {
    tournamentId,
    actorUserId: userId,
    actorName,
    action: "Reglas actualizadas",
    entity: "tournamentRules",
    entityId: rulesDoc._id,
    detail: `Tamaño de plantilla: 20 → ${DEFAULT_RULES.squadSize} · cupos de medios ${DEFAULT_RULES.midMin}-${DEFAULT_RULES.midMax} · delanteros ${DEFAULT_RULES.fwdMin}-${DEFAULT_RULES.fwdMax} (configuración inicial migrada para habilitar el mercado)`,
  });
}

/* ------------------------------------------------------------------ *
 * Main control-room query
 * ------------------------------------------------------------------ */

export const state = query({
  args: {},
  handler: async (ctx): Promise<AppStateView | NeedsLeagueState | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const email = user.email ?? "";
    const baseNickname = nicknameFromEmail(email);
    const knownUser = {
      id: userId,
      name: user.name?.trim() || baseNickname.replace("@", ""),
      email,
      nickname: baseNickname,
    };

    const tournament = await getTournament(ctx);
    if (!tournament) {
      // No league anywhere: the UI shows the create/join gate.
      return {
        needsLeague: true,
        user: knownUser,
        leagues: [],
      };
    }

    const rules = await loadRules(ctx, tournament._id);
    const admin = await loadAdmin(ctx, tournament._id, userId);
    const clubs = await buildClubViews(ctx, tournament._id);
    const tournamentView = toTournamentView(tournament);

    const president = await loadPresident(ctx, tournament._id, userId);

    // Build team catalog for the active tournament.
    const allTeams = await ctx.db.query("teamCatalog").collect();
    const tournamentClubs = await ctx.db
      .query("clubs")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
      .collect();
    const takenByCatalog = new Map<string, Id<"clubs">>();
    for (const club of tournamentClubs) {
      if (club.catalogTeamId) {
        takenByCatalog.set(club.catalogTeamId, club._id);
      }
    }
    const presArtifacts = await ctx.db
      .query("presidents")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
      .collect();
    const ownerByClub = new Map(
      presArtifacts.map((p) => [p.clubId as string, p.userId]),
    );
    const teamCatalog = allTeams
      .map((team) => {
        const clubId = takenByCatalog.get(team._id) ?? null;
        return {
          id: team._id,
          name: team.name,
          league: team.league,
          country: team.country,
          colors: [team.colorPrimary, team.colorSecondary] as [string, string],
          takenByMe:
            clubId !== null &&
            ownerByClub.get(clubId) === userId,
          takenByOther:
            clubId !== null &&
            ownerByClub.get(clubId) !== undefined &&
            ownerByClub.get(clubId) !== userId,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!president) {
      return {
        needsClub: true,
        needsLeague: false,
        leagues: await buildMyLeagues(ctx, userId, tournament._id),
        user: knownUser,
        tournament: tournamentView,
        rules,
        president: null,
        club: null,
        clubs,
        teamCatalog,
        squad: [],
        stats: null,
        evaluation: null,
        lineup: null,
        lineupEvaluation: null,
        budget: { initial: rules.budget, committed: 0, available: rules.budget },
        availability: {
          transferible: 0,
          negociacion: 0,
          neutro: 0,
          intransferible: 0,
        },
        nextEvent: null,
        isAdmin: Boolean(admin),
        adminRole: admin?.role ?? null,
        market: emptyMarket(tournament.marketOpen),
        draft: null,
        competition: await buildCompetitionSummary(ctx, tournament._id, null),
        actions: [],
        activity: [],
      };
    }

    const club = clubs.find((c) => c.id === president.clubId) ?? null;
    const squadDoc = await ctx.db
      .query("squads")
      .withIndex("by_club", (q) => q.eq("clubId", president.clubId))
      .first();
    const squad = squadDoc ? await loadSquadPlayers(ctx, squadDoc._id) : [];
    const stats = computeSquadStats(squad);

    const availability: Record<PlayerAvailability, number> = {
      transferible: 0,
      negociacion: 0,
      neutro: 0,
      intransferible: 0,
    };
    for (const player of squad) availability[player.availability] += 1;

    const budget = {
      initial: rules.budget,
      committed: Math.max(0, rules.budget - president.budget),
      available: president.budget,
    };

    const evaluation = evaluateSquadRules(
      rules,
      squad,
      budget.available,
      club?.name,
    );

    const formation: FormationCode =
      squadDoc && isFormationCode(squadDoc.formation)
        ? squadDoc.formation
        : DEFAULT_FORMATION;
    const lineup: Lineup =
      squadDoc && squadDoc.lineup.length > 0
        ? {
            formation,
            slots: squadDoc.lineup.map((slot) => ({
              slotId: slot.slotId,
              playerId: slot.playerId ?? null,
            })),
          }
        : emptyLineup(formation);

    const lineupEvaluation = evaluateLineup(rules, squad, lineup, evaluation);
    const nextEvent = buildNextEvent(
      tournament,
      clubs,
      president.clubId,
      rules,
    );

    const draft = await loadDraftSummary(ctx, {
      tournamentId: tournament._id,
      rules,
      presidentId: president._id,
    });

    const competition = await buildCompetitionSummary(
      ctx,
      tournament._id,
      president.clubId,
    );

    const activity = await buildActivity(ctx, tournament._id, 10);

    const offers = await loadTournamentOffers(ctx, tournament._id);
    const offerViews = await buildOffers(ctx, {
      tournamentId: tournament._id,
      offers,
      viewerPresidentId: president._id,
      tournamentAllowsOperations:
        tournament.status !== "suspendido" && tournament.status !== "cancelado",
      marketOpen: tournament.marketOpen,
    });
    const mine = offerViews.filter((offer) => offer.side !== "sistema");
    const openStatuses = (status: OfferStatus) => OPEN_STATUSES.includes(status);
    const reservedStatuses = (status: OfferStatus) =>
      status === "reservada" || status === "aceptada";
    const freeAgentRows = await ctx.db
      .query("players")
      .withIndex("by_real_club", (q) => q.eq("realClub", FREE_AGENT_CLUB))
      .collect();
    const ownedPlayerIds = new Set(
      (
        await ctx.db
          .query("squadPlayers")
          .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
          .collect()
      ).map((row) => row.playerId as string),
    );
    const market: MarketSummaryView = {
      open: tournament.marketOpen,
      freeAgents: freeAgentRows.filter((player) => !ownedPlayerIds.has(player._id as string))
        .length,
      received: mine.filter(
        (offer) => offer.side === "recibida" && openStatuses(offer.status),
      ).length,
      sent: mine.filter(
        (offer) => offer.side === "enviada" && openStatuses(offer.status),
      ).length,
      reserved: mine.filter((offer) => reservedStatuses(offer.status)).length,
      executed: mine.filter((offer) => offer.status === "ejecutada").length,
      committedCash: offers
        .filter(
          (offer) =>
            offer.bidderPresidentId === president._id &&
            COMMITTED_STATUSES.includes(offer.status as OfferStatus),
        )
        .reduce((sum, offer) => sum + offer.cash, 0),
    };

    return {
      needsClub: false,
      needsLeague: false,
      leagues: await buildMyLeagues(ctx, userId, tournament._id),
      user: knownUser,
      tournament: tournamentView,
      rules,
      president: {
        id: president._id,
        userId: president.userId,
        nickname: president.nickname,
        displayName: president.displayName,
        email,
        clubId: president.clubId,
        clubName: club?.name ?? "—",
        clubShortName: club?.shortName ?? "—",
        clubColors: [
          club?.colorPrimary ?? "#1d4ed8",
          club?.colorSecondary ?? "#0b1a30",
        ],
        budget: president.budget,
        joinedAt: president.joinedAt,
        isAdmin: Boolean(admin),
        adminRole: admin?.role ?? null,
        squadSize: squad.length,
      },
      club,
      clubs,
      squad,
      stats,
      evaluation,
      lineup,
      lineupEvaluation,
      budget,
      availability,
      nextEvent,
      isAdmin: Boolean(admin),
      adminRole: admin?.role ?? null,
      market,
      draft,
      competition,
      actions: buildActions({
        isAdmin: Boolean(admin),
        market: {
          received: market.received,
          reserved: market.reserved,
          open: market.open,
        },
        draft: {
          status: draft.status,
          isMyTurn: draft.isMyTurn,
          myPicks: draft.myPicks,
          poolSize: draft.poolSize,
          currentNickname: draft.currentNickname,
          myPosition: draft.myPosition,
          round: draft.round,
          totalRounds: draft.totalRounds,
        },
        squadSize: squad.length,
        availability,
        violations: evaluation.violations.map((violation) => ({
          id: violation.id,
          detail: violation.detail,
        })),
        lineupValid: lineupEvaluation.valid,
        lineupComplete: lineupEvaluation.starters.length === 11,
        lockAt: nextEvent?.lockAt ?? null,
        rules,
        competition: {
          myFixture: competition.myMatch
            ? {
                rivalName:
                  competition.myMatch.fixture.home.clubId === president.clubId
                    ? competition.myMatch.fixture.away.name
                    : competition.myMatch.fixture.home.name,
                kickoffAt: competition.myMatch.fixture.kickoffAt,
              }
            : null,
          previousResult: competition.previousMatch
            ? {
                myPoints: competition.previousMatch.myPoints ?? 0,
                rivalPoints: competition.previousMatch.rivalPoints ?? 0,
              }
            : null,
        },
      }),
      activity,
      teamCatalog,
    };
  },
});

/* ------------------------------------------------------------------ *
 * Club selection
 * ------------------------------------------------------------------ */

/**
 * LEGACY claim path kept so pre-catalogue deployments keep compiling while the
 * UI migrates: claims an EXISTING club row of the active league with an empty
 * squad. New flows must use `chooseCatalogTeam`.
 */
export const chooseClub = mutation({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const userId = requireAuth(await getAuthUserId(ctx));
    const user = await ctx.db.get(userId);
    const tournament = await getTournament(ctx);
    if (!tournament) {
      throw new ConvexError("Primero crea o únete a una liga.");
    }

    const club = await ctx.db.get(clubId);
    if (!club || club.tournamentId !== tournament._id) {
      throw new ConvexError("El club seleccionado no pertenece a esta liga.");
    }

    const existing = await loadPresident(ctx, tournament._id, userId);
    if (existing) {
      throw new ConvexError(
        "Ya presides un equipo en esta liga. Un cambio requiere autorización de Administración.",
      );
    }

    const taken = await ctx.db
      .query("presidents")
      .withIndex("by_club", (q) => q.eq("clubId", clubId))
      .first();
    if (taken) {
      throw new ConvexError(
        `${club.name} ya tiene Presidente en esta liga. Elige otro equipo disponible.`,
      );
    }

    const rules = await loadRules(ctx, tournament._id);
    const nickname = nicknameFromEmail(user?.email ?? "");
    const displayName = user?.name?.trim() || nickname.replace("@", "");
    const now = Date.now();

    const presidentId = await ctx.db.insert("presidents", {
      tournamentId: tournament._id,
      userId,
      nickname,
      displayName,
      clubId,
      budget: rules.budget,
      joinedAt: now,
    });

    const { size } = await createSquadForClub(ctx, {
      tournamentId: tournament._id,
      clubId,
      presidentId,
      clubName: club.name,
    });

    await logAudit(ctx, {
      tournamentId: tournament._id,
      clubId,
      actorUserId: userId,
      actorName: displayName,
      action: "Presidencia asumida",
      entity: "club",
      entityId: clubId,
      detail: `${displayName} (${nickname}) asume la presidencia de ${club.name} · plantilla vacía: se construye en el primer draft · presupuesto ${formatMoney(rules.budget)}`,
    });

    return { clubId, squadSize: size };
  },
});

/**
 * A President picks ANY team from the global catalogue for their ACTIVE
 * league. The club is instantiated league-scoped with an EMPTY squad (draft
 * fills it) and the President gets the full rules budget. The old fixed-roster
 * club picker (`chooseClub`) was replaced by this catalogue flow.
 */
export const chooseCatalogTeam = mutation({
  args: { catalogTeamId: v.id("teamCatalog") },
  handler: async (ctx, { catalogTeamId }) => {
    const userId = requireAuth(await getAuthUserId(ctx));
    const user = await ctx.db.get(userId);
    const tournament = await getTournament(ctx);
    if (!tournament) {
      throw new ConvexError(
        "Primero crea o únete a una liga para elegir tu equipo.",
      );
    }

    const team = await ctx.db.get(catalogTeamId);
    if (!team) {
      throw new ConvexError(
        "Ese equipo ya no está en el catálogo. Sincroniza de nuevo desde SoFIFA.",
      );
    }

    const existing = await loadPresident(ctx, tournament._id, userId);
    if (existing) {
      throw new ConvexError(
        "Ya presides un equipo en esta liga. Un cambio de club requiere autorización de Administración.",
      );
    }

    const clubs = await ctx.db
      .query("clubs")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
      .collect();
    const alreadyUsed = clubs.find(
      (club) => club.catalogTeamId === catalogTeamId,
    );
    if (alreadyUsed) {
      throw new ConvexError(
        `${team.name} ya fue elegido por otro Presidente en ${tournament.name}. Elige otro equipo disponible.`,
      );
    }

    const rules = await loadRules(ctx, tournament._id);
    const nickname = nicknameFromEmail(user?.email ?? "");
    const displayName = user?.name?.trim() || nickname.replace("@", "");
    const now = Date.now();

    const clubId = await ctx.db.insert("clubs", {
      tournamentId: tournament._id,
      name: team.name,
      shortName: team.name
        .replace(/[().]/g, "")
        .split(/\s+/)
        .slice(0, 3)
        .map((word) => word[0])
        .join("")
        .toUpperCase(),
      league: team.league,
      country: team.country,
      colorPrimary: team.colorPrimary,
      colorSecondary: team.colorSecondary,
      catalogTeamId: team._id,
    });

    const presidentId = await ctx.db.insert("presidents", {
      tournamentId: tournament._id,
      userId,
      nickname,
      displayName,
      clubId,
      budget: rules.budget,
      joinedAt: now,
    });

    const { size } = await createSquadForClub(ctx, {
      tournamentId: tournament._id,
      clubId,
      presidentId,
      clubName: team.name,
    });

    // Membership safety net (creator/join flows already insert it).
    const memberships = await ctx.db
      .query("leagueMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (!memberships.some((row) => row.tournamentId === tournament._id)) {
      const alreadyAdmin = Boolean(
        await loadAdmin(ctx, tournament._id, userId),
      );
      await ctx.db.insert("leagueMembers", {
        tournamentId: tournament._id,
        userId,
        role: alreadyAdmin ? "administrador" : "presidente",
        joinedAt: now,
      });
    }

    await logAudit(ctx, {
      tournamentId: tournament._id,
      clubId,
      actorUserId: userId,
      actorName: displayName,
      action: "Presidencia asumida",
      entity: "club",
      entityId: clubId,
      detail: `${displayName} (${nickname}) asume la presidencia de ${team.name} (${team.league}) · plantilla vacía: se construye en el primer draft · presupuesto ${formatMoney(rules.budget)}`,
    });

    return { clubId, squadSize: size };
  },
});

/* ------------------------------------------------------------------ *
 * Profile
 * ------------------------------------------------------------------ */

export const updateProfile = mutation({
  args: {
    nickname: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, { nickname, displayName }) => {
    const userId = requireAuth(await getAuthUserId(ctx));
    const tournament = await getTournament(ctx);
    if (!tournament) throw new ConvexError("El torneo no está disponible.");

    const cleanNickname = nickname.trim().replace(/^@+/, "");
    if (cleanNickname.length < 3 || cleanNickname.length > 20) {
      throw new ConvexError(
        "El nickname debe tener entre 3 y 20 caracteres para identificarte ante los demás Presidentes.",
      );
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(cleanNickname)) {
      throw new ConvexError(
        "El nickname solo admite letras, números, puntos, guiones y guiones bajos.",
      );
    }

    const taken = await ctx.db
      .query("presidents")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
      .collect();
    if (
      taken.some(
        (president) =>
          president.userId !== userId &&
          president.nickname.toLowerCase() === `@${cleanNickname.toLowerCase()}`,
      )
    ) {
      throw new ConvexError(
        `El nickname @${cleanNickname} ya está en uso en este torneo. Prueba con otro.`,
      );
    }

    const president = await loadPresident(ctx, tournament._id, userId);
    const resolvedName = displayName?.trim();
    if (resolvedName) {
      await ctx.db.patch(userId, { name: resolvedName });
    }

    if (!president) {
      return { nickname: `@${cleanNickname}` };
    }

    await ctx.db.patch(president._id, {
      nickname: `@${cleanNickname}`,
      displayName: resolvedName || president.displayName,
    });

    await logAudit(ctx, {
      tournamentId: tournament._id,
      clubId: president.clubId,
      actorUserId: userId,
      actorName: resolvedName || president.displayName,
      action: "Perfil actualizado",
      entity: "president",
      entityId: president._id,
      detail: `Nuevo nickname público: @${cleanNickname}`,
    });

    return { nickname: `@${cleanNickname}` };
  },
});

/* ------------------------------------------------------------------ *
 * Administration
 * ------------------------------------------------------------------ */

export const adminOverview = query({
  args: {},
  handler: async (ctx): Promise<AdminOverviewView | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const tournament = await getTournament(ctx);
    if (!tournament) return null;
    const admin = await loadAdmin(ctx, tournament._id, userId);
    if (!admin) return null;

    const rules = await loadRules(ctx, tournament._id);
    const presidents = await buildPresidents(ctx, tournament._id);
    const admins = await buildAdmins(ctx, tournament._id);
    const clubs = await buildClubViews(ctx, tournament._id);
    const activity = await buildActivity(ctx, tournament._id, 40);

    const squads = await ctx.db
      .query("squads")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
      .collect();
    const squadPlayers = await ctx.db
      .query("squadPlayers")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
      .collect();

    const offers = await loadTournamentOffers(ctx, tournament._id);
    const offerViews = await buildOffers(ctx, {
      tournamentId: tournament._id,
      offers,
      viewerPresidentId: null,
      tournamentAllowsOperations:
        tournament.status !== "suspendido" && tournament.status !== "cancelado",
      marketOpen: tournament.marketOpen,
    });

    return {
      tournament: toTournamentView(tournament),
      rules,
      presidents,
      admins,
      clubs,
      activity,
      market: {
        open: tournament.marketOpen,
        reserved: offerViews.filter(
          (offer) => offer.status === "reservada" || offer.status === "aceptada",
        ),
        recent: offerViews.slice(0, 12),
        pending: offerViews.filter(
          (offer) => offer.status === "enviada" || offer.status === "negociacion",
        ).length,
      },
      draft: await loadDraftAdmin(ctx, {
        tournamentId: tournament._id,
        rules,
      }),
      competition: await buildCompetitionSummary(
        ctx,
        tournament._id,
        null,
      ),
      totals: {
        squads: squads.length,
        players: squadPlayers.length,
        committedBudget: presidents.reduce(
          (sum, president) => sum + president.budget,
          0,
        ),
        freeClubs: clubs.filter((club) => !club.presidentNickname).length,
      },
    };
  },
});

/** Only the rule engine enforces rules — Administration only tunes its inputs. */
export const updateRules = mutation({
  args: {
    budget: v.number(),
    squadSize: v.number(),
    gkMin: v.number(),
    gkMax: v.number(),
    defMin: v.number(),
    defMax: v.number(),
    midMin: v.number(),
    midMax: v.number(),
    fwdMin: v.number(),
    fwdMax: v.number(),
    maxPerRealClub: v.number(),
    minOvr: v.number(),
    maxU21: v.number(),
    lineupLockHours: v.number(),
  },
  handler: async (ctx, next) => {
    const userId = requireAuth(await getAuthUserId(ctx));
    const tournament = await getTournament(ctx);
    if (!tournament) throw new ConvexError("El torneo no está disponible.");
    await requireAdmin(ctx, tournament._id, userId, "configuracion");

    const current = await loadRules(ctx, tournament._id);

    const groups: Array<{ label: string; min: number; max: number }> = [
      { label: "Porteros", min: next.gkMin, max: next.gkMax },
      { label: "Defensas", min: next.defMin, max: next.defMax },
      { label: "Medios", min: next.midMin, max: next.midMax },
      { label: "Delanteros", min: next.fwdMin, max: next.fwdMax },
    ];
    for (const group of groups) {
      if (group.min < 0 || group.max < group.min) {
        throw new ConvexError(
          `El rango de ${group.label} no es válido: el mínimo no puede superar al máximo.`,
        );
      }
    }
    if (next.squadSize < 11 || next.squadSize > 40) {
      throw new ConvexError(
        "El tamaño de plantilla debe estar entre 11 y 40 jugadores.",
      );
    }
    const minimumNeeded = groups.reduce((sum, group) => sum + group.min, 0);
    if (minimumNeeded > next.squadSize) {
      throw new ConvexError(
        `Los mínimos por posición suman ${minimumNeeded} jugadores y no caben en una plantilla de ${next.squadSize}.`,
      );
    }
    if (next.budget < 0) {
      throw new ConvexError("El presupuesto no puede ser negativo.");
    }
    if (next.maxU21 < 0 || next.maxU21 > 15) {
      throw new ConvexError("El límite de sub-21 debe estar entre 0 y 15.");
    }

    const changes: string[] = [];
    const compare = (label: string, before: number, after: number, money = false) => {
      if (before === after) return;
      changes.push(
        money
          ? `${label}: ${formatMoney(before)} → ${formatMoney(after)}`
          : `${label}: ${before} → ${after}`,
      );
    };
    compare("Presupuesto", current.budget, next.budget, true);
    compare("Tamaño de plantilla", current.squadSize, next.squadSize);
    compare("Porteros mín.", current.gkMin, next.gkMin);
    compare("Porteros máx.", current.gkMax, next.gkMax);
    compare("Defensas mín.", current.defMin, next.defMin);
    compare("Defensas máx.", current.defMax, next.defMax);
    compare("Medios mín.", current.midMin, next.midMin);
    compare("Medios máx.", current.midMax, next.midMax);
    compare("Delanteros mín.", current.fwdMin, next.fwdMin);
    compare("Delanteros máx.", current.fwdMax, next.fwdMax);
    compare("Jugadores por club real", current.maxPerRealClub, next.maxPerRealClub);
    compare("OVR mínimo", current.minOvr, next.minOvr);
    compare("Sub-21 máx.", current.maxU21, next.maxU21);
    compare("Cierre de alineación (h)", current.lineupLockHours, next.lineupLockHours);

    if (changes.length === 0) {
      return { changed: 0 };
    }

    const rulesDoc = await ctx.db
      .query("tournamentRules")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
      .first();
    if (rulesDoc) {
      await ctx.db.patch(rulesDoc._id, { ...next, updatedAt: Date.now(), updatedBy: userId });
    } else {
      await ctx.db.insert("tournamentRules", {
        tournamentId: tournament._id,
        ...next,
        updatedAt: Date.now(),
        updatedBy: userId,
      });
    }

    const user = await ctx.db.get(userId);
    await logAudit(ctx, {
      tournamentId: tournament._id,
      actorUserId: userId,
      actorName: user?.name ?? "Administración",
      action: "Reglas actualizadas",
      entity: "tournamentRules",
      entityId: rulesDoc?._id ?? tournament._id,
      detail: changes.join(" · "),
    });

    return { changed: changes.length, changes };
  },
});

export const setTournamentStatus = mutation({
  args: {
    status: tournamentStatusValidator,
    marketOpen: v.optional(v.boolean()),
  },
  handler: async (ctx, { status, marketOpen }) => {
    const userId = requireAuth(await getAuthUserId(ctx));
    const tournament = await getTournament(ctx);
    if (!tournament) throw new ConvexError("El torneo no está disponible.");
    await requireAdmin(ctx, tournament._id, userId, "configuracion");

    await ctx.db.patch(tournament._id, {
      status,
      marketOpen: marketOpen ?? tournament.marketOpen,
    });

    const user = await ctx.db.get(userId);
    await logAudit(ctx, {
      tournamentId: tournament._id,
      actorUserId: userId,
      actorName: user?.name ?? "Administración",
      action: "Estado del torneo actualizado",
      entity: "tournament",
      entityId: tournament._id,
      detail: `${tournament.status} → ${status}${typeof marketOpen === "boolean" ? ` · mercado ${marketOpen ? "abierto" : "cerrado"}` : ""}`,
    });

    return { status };
  },
});

/** Admin is a role, not an account: a President can also be Administrator. */
export const grantAdmin = mutation({
  args: {
    email: v.string(),
    role: adminRoleValidator,
    permissions: v.array(v.string()),
  },
  handler: async (ctx, { email, role, permissions }) => {
    const userId = requireAuth(await getAuthUserId(ctx));
    const tournament = await getTournament(ctx);
    if (!tournament) throw new ConvexError("El torneo no está disponible.");
    await requireAdmin(ctx, tournament._id, userId, "presidentes");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes("@")) {
      throw new ConvexError(
        "Introduce un correo válido para asignar el rol de Administrador.",
      );
    }

    const invited = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", cleanEmail))
      .first();
    if (!invited) {
      throw new ConvexError(
        `No existe ninguna cuenta con ${cleanEmail} en este torneo. Pídele que se registre con ese correo y vuelve a intentarlo.`,
      );
    }

    const validPermissions = permissions.filter((permission) =>
      (PERMISSIONS as readonly string[]).includes(permission),
    );
    const granted = role === "principal" ? [...PERMISSIONS] : validPermissions;

    const existing = await loadAdmin(ctx, tournament._id, invited._id);
    if (existing) {
      await ctx.db.patch(existing._id, { role, permissions: granted });
    } else {
      await ctx.db.insert("tournamentAdmins", {
        tournamentId: tournament._id,
        userId: invited._id,
        role,
        permissions: granted,
        createdAt: Date.now(),
      });
    }

    const actor = await ctx.db.get(userId);
    await logAudit(ctx, {
      tournamentId: tournament._id,
      actorUserId: userId,
      actorName: actor?.name ?? "Administración",
      action: existing ? "Permisos de administrador actualizados" : "Administrador asignado",
      entity: "tournamentAdmins",
      entityId: invited._id,
      detail: `${invited.name ?? invited.email ?? cleanEmail} · rol ${role === "principal" ? "Administrador principal" : "Co-Administrador"} · permisos: ${granted.length ? granted.join(", ") : "ninguno"}`,
    });

    return { granted: granted.length };
  },
});

export const revokeAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId: targetUserId }) => {
    const userId = requireAuth(await getAuthUserId(ctx));
    const tournament = await getTournament(ctx);
    if (!tournament) throw new ConvexError("El torneo no está disponible.");
    await requireAdmin(ctx, tournament._id, userId, "presidentes");

    if (targetUserId === userId) {
      throw new ConvexError(
        "No puedes retirarte a ti mismo el rol de Administrador principal.",
      );
    }

    const admin = await loadAdmin(ctx, tournament._id, targetUserId);
    if (!admin) {
      throw new ConvexError("Esa cuenta no es Administrador de este torneo.");
    }

    await ctx.db.delete(admin._id);
    const actor = await ctx.db.get(userId);
    const target = await ctx.db.get(targetUserId);
    await logAudit(ctx, {
      tournamentId: tournament._id,
      actorUserId: userId,
      actorName: actor?.name ?? "Administración",
      action: "Permisos de administrador retirados",
      entity: "tournamentAdmins",
      entityId: targetUserId,
      detail: `${target?.name ?? target?.email ?? "Cuenta"} deja de ser Administrador del torneo.`,
    });

    return { revoked: true };
  },
});
