import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
void v;
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type {
  CompetitionCalendarView,
  CompetitionSummaryView,
  FixtureSideView,
  FixtureView,
  MatchdayGroupView,
  MyMatchView,
  StandingRowView,
} from "./appTypes";
import {
  MATCHDAY_STATUS_LABEL,
  buildCalendar,
  computeStandings,
  kickoffForMatchday,
  matchdayStatusOf,
  resolveFixture,
} from "./competitionEngine";
import {
  getTournament,
  loadAdmin,
  loadPresident,
  loadRules,
  loadSquadPlayers,
  logAudit,
  toTournamentView,
} from "./context";
import {
  DEFAULT_FORMATION,
  emptyLineup,
  isFormationCode,
  type FormationCode,
  type Lineup,
  type SquadPlayerView,
} from "./rulesEngine";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ *
 * Calendar anchor
 * ------------------------------------------------------------------ */

/**
 * Kickoff anchor for the seeded jornada: the coming Sunday 18:00 UTC, so the
 * calendar is stable no matter which day the tournament is bootstrapped on.
 */
export function calendarAnchor(now: number): number {
  const day = new Date(now).getUTCDay(); // 0 = Sunday
  const daysToSunday = (7 - day) % 7 || 7;
  const sunday = new Date(now + daysToSunday * 24 * 60 * 60 * 1000);
  sunday.setUTCHours(18, 0, 0, 0);
  return sunday.getTime();
}

/* ------------------------------------------------------------------ *
 * Squad / XI helpers
 * ------------------------------------------------------------------ */

export async function loadSquadByClub(
  ctx: QueryCtx,
  clubId: Id<"clubs">,
): Promise<{
  squadId: Id<"squads"> | null;
  formation: FormationCode;
  players: SquadPlayerView[];
  lineup: Lineup;
}> {
  const squadDoc = await ctx.db
    .query("squads")
    .withIndex("by_club", (q) => q.eq("clubId", clubId))
    .first();
  if (!squadDoc) {
    return {
      squadId: null,
      formation: DEFAULT_FORMATION,
      players: [],
      lineup: emptyLineup(DEFAULT_FORMATION),
    };
  }
  const formation: FormationCode = isFormationCode(squadDoc.formation)
    ? squadDoc.formation
    : DEFAULT_FORMATION;
  const players = await loadSquadPlayers(ctx, squadDoc._id);
  const lineup: Lineup =
    squadDoc.lineup.length > 0
      ? {
          formation,
          slots: squadDoc.lineup.map((slot) => ({
            slotId: slot.slotId,
            playerId: slot.playerId ?? null,
          })),
        }
      : emptyLineup(formation);
  return { squadId: squadDoc._id, formation, players, lineup };
}

/** The XI a club would present: starters assigned in its saved lineup. */
export function startersOf(
  players: SquadPlayerView[],
  lineup: Lineup,
): SquadPlayerView[] {
  const byId = new Map(players.map((player) => [player.playerId as string, player]));
  const starters: SquadPlayerView[] = [];
  for (const slot of lineup.slots) {
    if (!slot.playerId) continue;
    const player = byId.get(slot.playerId);
    if (player) starters.push(player);
  }
  return starters;
}

export function averageOvr(starters: SquadPlayerView[]): number {
  if (starters.length === 0) return 0;
  const total = starters.reduce((sum, player) => sum + player.ovr, 0);
  return Math.round((total / starters.length) * 10) / 10;
}

/* ------------------------------------------------------------------ *
 * Fixture seeding
 * ------------------------------------------------------------------ */

/**
 * Idempotent: a double round-robin over the tournament clubs, anchored to the
 * seeded jornada. Safe to call on an already seeded deployment.
 */
export async function seedFixtures(
  ctx: MutationCtx,
  tournament: Doc<"tournaments">,
): Promise<number> {
  const existing = await ctx.db
    .query("fixtures")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
    .first();
  if (existing) return 0;

  const clubs = await ctx.db
    .query("clubs")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
    .collect();
  if (clubs.length < 2) return 0;

  const anchor = calendarAnchor(Date.now());
  const calendar = buildCalendar(clubs.map((club) => club._id));

  for (const seed of calendar) {
    await ctx.db.insert("fixtures", {
      tournamentId: tournament._id,
      matchday: seed.matchday,
      homeClubId: seed.homeClubId as Id<"clubs">,
      awayClubId: seed.awayClubId as Id<"clubs">,
      status:
        seed.matchday === tournament.currentMatchday ? "en_curso" : "programado",
      kickoffAt: kickoffForMatchday({
        matchday: seed.matchday,
        currentMatchday: tournament.currentMatchday,
        anchor,
      }),
    });
  }

  await logAudit(ctx, {
    tournamentId: tournament._id,
    actorName: "Sistema",
    action: "Calendario generado",
    entity: "fixture",
    detail: `${calendar.length} partidos programados: ida y vuelta entre ${clubs.length} clubes (${calendar.length / 2} jornadas).`,
  });

  return calendar.length;
}

/* ------------------------------------------------------------------ *
 * Playing a matchday
 * ------------------------------------------------------------------ */

/**
 * Resolves every fixture of the current matchday from the XIs saved at lock
 * time, activates the next matchday and advances the tournament. Auth and
 * admin checks live in the mutation wrapper so the harness can call this
 * directly.
 */
export async function playMatchday(
  ctx: MutationCtx,
  tournament: Doc<"tournaments">,
  actorName: string,
): Promise<{
  closedMatchday: number;
  played: number;
  nextMatchday: number | null;
  lines: string[];
}> {
  const fixtures = await ctx.db
    .query("fixtures")
    .withIndex("by_tournament_matchday", (q) =>
      q
        .eq("tournamentId", tournament._id)
        .eq("matchday", tournament.currentMatchday),
    )
    .collect();
  if (fixtures.length === 0) {
    throw new ConvexError(
      "No hay partidos programados para la jornada actual. Genera el calendario primero.",
    );
  }

  const clubDocs = await ctx.db
    .query("clubs")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
    .collect();
  const clubById = new Map(clubDocs.map((club) => [club._id as string, club]));

  const now = Date.now();
  const lines: string[] = [];

  for (const fixture of fixtures) {
    if (fixture.status === "jugado") continue;
    const home = await loadSquadByClub(ctx, fixture.homeClubId);
    const away = await loadSquadByClub(ctx, fixture.awayClubId);
    const homeXi = startersOf(home.players, home.lineup);
    const awayXi = startersOf(away.players, away.lineup);
    const matchKey = `${tournament.code}:j${fixture.matchday}:${fixture.homeClubId}:${fixture.awayClubId}`;
    const outcome = resolveFixture({
      matchKey,
      homeXiOvr: averageOvr(homeXi),
      awayXiOvr: averageOvr(awayXi),
    });

    await ctx.db.patch(fixture._id, {
      status: "jugado",
      homeGoals: outcome.homeGoals,
      awayGoals: outcome.awayGoals,
      homePoints: outcome.homePoints,
      awayPoints: outcome.awayPoints,
      homeXiOvr: averageOvr(homeXi),
      awayXiOvr: averageOvr(awayXi),
      playedAt: now,
    });

    const homeName = clubById.get(fixture.homeClubId as string)?.name ?? "Local";
    const awayName = clubById.get(fixture.awayClubId as string)?.name ?? "Visitante";
    lines.push(
      `${homeName} ${outcome.homeGoals}–${outcome.awayGoals} ${awayName} (${outcome.homePoints}–${outcome.awayPoints} pts)`,
    );
  }

  // Activate the next matchday, if the calendar still has one.
  const nextMatchday = tournament.currentMatchday + 1;
  const nextRows = await ctx.db
    .query("fixtures")
    .withIndex("by_tournament_matchday", (q) =>
      q.eq("tournamentId", tournament._id).eq("matchday", nextMatchday),
    )
    .collect();

  for (const row of nextRows) {
    if (row.status === "programado") {
      await ctx.db.patch(row._id, { status: "en_curso" });
    }
  }

  if (nextRows.length > 0) {
    const nextKickoff = Math.min(...nextRows.map((row) => row.kickoffAt));
    await ctx.db.patch(tournament._id, {
      currentMatchday: nextMatchday,
      nextMatchdayAt: nextKickoff > now ? nextKickoff : now + WEEK_MS,
    });
  }

  await logAudit(ctx, {
    tournamentId: tournament._id,
    actorName,
    action: "Jornada cerrada",
    entity: "fixture",
    detail: `Jornada ${tournament.currentMatchday}: ${lines.length} partido(s) resueltos.${lines.length ? " " + lines.join(" · ") : ""}`,
  });

  return {
    closedMatchday: tournament.currentMatchday,
    played: lines.length,
    nextMatchday: nextRows.length > 0 ? nextMatchday : null,
    lines,
  };
}

/* ------------------------------------------------------------------ *
 * Auth + permission wrappers
 * ------------------------------------------------------------------ */

async function requireCompetitionAdmin(
  ctx: QueryCtx | MutationCtx,
  tournamentId: Id<"tournaments">,
  userId: Id<"users">,
): Promise<string> {
  const admin = await loadAdmin(ctx, tournamentId, userId);
  if (!admin) {
    throw new ConvexError(
      "Cerrar jornadas requiere permisos de Administrador del torneo.",
    );
  }
  if (admin.role === "principal") return "Administrador principal";
  if (!admin.permissions.includes("calendario")) {
    throw new ConvexError(
      "Tu rol de Co-Administrador no incluye el permiso de calendario. Solicítalo al Administrador principal.",
    );
  }
  return "Co-Administrador";
}

/** Idempotent competition sync: seed the calendar + activate the current MD. */
export const syncCompetition = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Necesitas iniciar sesión para operar en el torneo.");
    }
    const tournament = await getTournament(ctx);
    if (!tournament) {
      throw new ConvexError("El torneo aún no está inicializado.");
    }
    const seeded = await seedFixtures(ctx, tournament);

    const currentRows = await ctx.db
      .query("fixtures")
      .withIndex("by_tournament_matchday", (q) =>
        q
          .eq("tournamentId", tournament._id)
          .eq("matchday", tournament.currentMatchday),
      )
      .collect();
    let activated = 0;
    for (const row of currentRows) {
      if (row.status === "programado") {
        await ctx.db.patch(row._id, { status: "en_curso" });
        activated += 1;
      }
    }
    return { seeded, activated };
  },
});

/** Admin closes the current matchday: results, standings and advancement. */
export const closeMatchday = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Necesitas iniciar sesión para operar en el torneo.");
    }
    const tournament = await getTournament(ctx);
    if (!tournament) {
      throw new ConvexError("El torneo aún no está inicializado.");
    }
    const actorName = await requireCompetitionAdmin(
      ctx,
      tournament._id,
      userId,
    );
    const user = await ctx.db.get(userId);

    if (tournament.status === "suspendido" || tournament.status === "cancelado") {
      throw new ConvexError(
        "El torneo está suspendido o cancelado: no se pueden cerrar jornadas hasta que Administración lo reactive.",
      );
    }

    const result = await playMatchday(ctx, tournament, user?.name ?? actorName);
    return {
      closedMatchday: result.closedMatchday,
      played: result.played,
      nextMatchday: result.nextMatchday,
    };
  },
});

/* ------------------------------------------------------------------ *
 * Summary builder (state, results page, admin)
 * ------------------------------------------------------------------ */

function toFixtureSide(
  club: Doc<"clubs"> | undefined,
  clubId: Id<"clubs">,
): FixtureSideView {
  return {
    clubId,
    name: club?.name ?? "Club sin asignar",
    shortName: club?.shortName ?? "—",
    colors: [
      club?.colorPrimary ?? "#1d4ed8",
      club?.colorSecondary ?? "#0b1a30",
    ],
  };
}

export function toFixtureView(
  fixture: Doc<"fixtures">,
  clubById: Map<string, Doc<"clubs">>,
): FixtureView {
  return {
    id: fixture._id,
    matchday: fixture.matchday,
    status: fixture.status,
    kickoffAt: fixture.kickoffAt,
    home: toFixtureSide(clubById.get(fixture.homeClubId as string), fixture.homeClubId),
    away: toFixtureSide(clubById.get(fixture.awayClubId as string), fixture.awayClubId),
    homeGoals: fixture.homeGoals ?? null,
    awayGoals: fixture.awayGoals ?? null,
    homePoints: fixture.homePoints ?? null,
    awayPoints: fixture.awayPoints ?? null,
    homeXiOvr: fixture.homeXiOvr ?? null,
    awayXiOvr: fixture.awayXiOvr ?? null,
  };
}

export async function buildCompetitionSummary(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
  myClubId: Id<"clubs"> | null,
): Promise<CompetitionSummaryView> {
  const tournament = await getTournament(ctx);
  const clubDocs = await ctx.db
    .query("clubs")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  const clubById = new Map(clubDocs.map((club) => [club._id as string, club]));
  const fixtures = await ctx.db
    .query("fixtures")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();

  const scored = fixtures.map((fixture) => ({
    homeClubId: fixture.homeClubId as string,
    awayClubId: fixture.awayClubId as string,
    homeGoals: fixture.homeGoals ?? 0,
    awayGoals: fixture.awayGoals ?? 0,
    homePoints: fixture.homePoints ?? 0,
    awayPoints: fixture.awayPoints ?? 0,
    played: fixture.status === "jugado",
  }));

  const standings = computeStandings(
    clubDocs.map((club) => ({
      clubId: club._id as string,
      clubName: club.name,
      clubShortName: club.shortName,
      clubColors: [club.colorPrimary, club.colorSecondary] as [string, string],
    })),
    scored,
  ).map((row, index): StandingRowView => ({ ...row, position: index + 1 }));

  const currentMatchday = tournament?.currentMatchday ?? 1;
  const byMatchday = new Map<number, Doc<"fixtures">[]>();
  for (const fixture of fixtures) {
    const list = byMatchday.get(fixture.matchday) ?? [];
    list.push(fixture);
    byMatchday.set(fixture.matchday, list);
  }

  const nicknameByClub = new Map<string, string>();
  if (myClubId) {
    const presidents = await ctx.db
      .query("presidents")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
    for (const president of presidents) {
      nicknameByClub.set(president.clubId as string, president.nickname);
    }
  }

  const buildMyMatch = (
    fixture: Doc<"fixtures">,
    matchdayStatus: "futura" | "en_curso" | "jugada",
  ): MyMatchView => {
    const view = toFixtureView(fixture, clubById);
    const mySide: "home" | "away" =
      fixture.homeClubId === myClubId ? "home" : "away";
    const rivalClubId =
      mySide === "home" ? fixture.awayClubId : fixture.homeClubId;
    return {
      matchday: fixture.matchday,
      status: matchdayStatus,
      fixture: view,
      mySide,
      myPoints:
        mySide === "home" ? (fixture.homePoints ?? null) : (fixture.awayPoints ?? null),
      rivalPoints:
        mySide === "home" ? (fixture.awayPoints ?? null) : (fixture.homePoints ?? null),
      myXiOvr:
        mySide === "home" ? (fixture.homeXiOvr ?? null) : (fixture.awayXiOvr ?? null),
      rivalNickname: nicknameByClub.get(rivalClubId as string) ?? null,
    };
  };

  const matchdays: MatchdayGroupView[] = [...byMatchday.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([matchday, rows]) => {
      const status = matchdayStatusOf({
        matchday,
        currentMatchday,
        allPlayed: rows.every((row) => row.status === "jugado"),
      });
      return {
        matchday,
        status,
        statusLabel: MATCHDAY_STATUS_LABEL[status],
        kickoffAt: rows.length ? Math.min(...rows.map((row) => row.kickoffAt)) : null,
        playedCount: rows.filter((row) => row.status === "jugado").length,
        fixtures: rows
          .map((row) => toFixtureView(row, clubById))
          .sort((a, b) =>
            (a.home?.name ?? "").localeCompare(b.home?.name ?? ""),
          ),
      };
    });

  // My fixture in the current matchday (or the next one with a game of mine).
  let myMatch: MyMatchView | null = null;
  if (myClubId) {
    for (const group of matchdays) {
      if (group.status === "jugada") continue;
      const row = group.fixtures.find(
        (fixture) =>
          fixture.home?.clubId === myClubId || fixture.away?.clubId === myClubId,
      );
      if (row) {
        const raw = byMatchday.get(group.matchday)?.find((r) => r._id === row.id);
        if (raw) {
          myMatch = buildMyMatch(raw, group.status);
          break;
        }
      }
    }
  }

  // My most recent played fixture.
  let previousMatch: MyMatchView | null = null;
  if (myClubId) {
    for (const group of [...matchdays].reverse()) {
      if (group.status !== "jugada") continue;
      const raw = byMatchday
        .get(group.matchday)
        ?.find(
          (row) =>
            row.status === "jugado" &&
            (row.homeClubId === myClubId || row.awayClubId === myClubId),
        );
      if (raw) {
        previousMatch = buildMyMatch(raw, "jugada");
        break;
      }
    }
  }

  return {
    available: fixtures.length > 0,
    currentMatchday,
    totalMatchdays: tournament?.totalMatchdays ?? 38,
    calendarMatchdays: matchdays.length,
    playedCount: fixtures.filter((fixture) => fixture.status === "jugado").length,
    totalCount: fixtures.length,
    standings,
    matchdays,
    myMatch,
    previousMatch,
    leader: standings[0] ?? null,
  };
}

/* ------------------------------------------------------------------ *
 * Public queries
 * ------------------------------------------------------------------ */

/** Full calendar + standings + my match context for the results page. */
export const calendar = query({
  args: {},
  handler: async (ctx): Promise<CompetitionCalendarView | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const tournament = await getTournament(ctx);
    if (!tournament) return null;
    const president = await loadPresident(ctx, tournament._id, userId);
    await loadRules(ctx, tournament._id); // keeps rules warm for derived views
    const summary = await buildCompetitionSummary(
      ctx,
      tournament._id,
      president?.clubId ?? null,
    );
    return { tournament: toTournamentView(tournament), summary };
  },
});
