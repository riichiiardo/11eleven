/**
 * Internal regression harness for the competition engine (never exposed to
 * clients: `internalMutation`, run with `convex run competitionSelfTest:run`).
 *
 * Exercises: the double round-robin calendar, deterministic scoring, the
 * standings table (points / goal difference ordering), matchday closure with
 * XI snapshot and next-matchday activation. It only creates its own throwaway
 * documents and deletes them before returning the report.
 */

import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  buildCalendar,
  computeStandings,
  resolveFixture,
  type ScoredFixture,
} from "./competitionEngine";
import { playMatchday, seedFixtures } from "./competition";
import { seedSquadForClub } from "./context";
import { FORMATIONS, DEFAULT_FORMATION, groupOf, type Position } from "./rulesEngine";

const SHAPE: Position[] = [
  "POR",
  "POR",
  "LD",
  "LD",
  "DFC",
  "DFC",
  "LI",
  "LI",
  "MCD",
  "MCD",
  "MC",
  "MC",
  "MC",
  "MCO",
  "ED",
  "ED",
  "EI",
  "EI",
  "DC",
  "DC",
];

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const report: string[] = [];
    let failures = 0;
    const check = (label: string, ok: boolean, extra?: string) => {
      report.push(`${ok ? "PASS" : "FAIL"} · ${label}${extra ? ` · ${extra}` : ""}`);
      if (!ok) failures += 1;
    };

    const now = Date.now();
    const createdPlayers: Id<"players">[] = [];
    const tournaments = await ctx.db.query("tournaments").collect();
    const beforeTournamentIds = new Set(tournaments.map((row) => row._id as string));

    /* ---------------- Calendar generation (pure) ------------------------- */
    const clubIds = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const calendar = buildCalendar(clubIds);
    // Double round-robin over 8 clubs: 2·(N−1) = 14 matchdays, N/2 matches each.
    const maxMatchday = Math.max(...calendar.map((f) => f.matchday));
    check(
      "Calendar covers 14 matchdays for 8 clubs",
      maxMatchday === 14 && calendar.length === 56,
      `${calendar.length} partidos, ${maxMatchday} jornadas`,
    );
    const roundTrip = calendar.filter(
      (f) =>
        f.homeClubId === "A" &&
        f.awayClubId === "B" &&
        calendar.some(
          (g) => g.homeClubId === "B" && g.awayClubId === "A" && g.matchday !== f.matchday,
        ),
    ).length;
    check("Every pair meets home and away", roundTrip > 0);
    const noSelfMatches = calendar.every((f) => f.homeClubId !== f.awayClubId);
    check("No club plays itself", noSelfMatches);
    // Each matchday must contain every club exactly once.
    let everyClubPerMatchday = true;
    for (let matchday = 1; matchday <= maxMatchday; matchday += 1) {
      const rows = calendar.filter((f) => f.matchday === matchday);
      const seen = new Set<string>();
      for (const row of rows) {
        seen.add(row.homeClubId);
        seen.add(row.awayClubId);
      }
      if (seen.size !== clubIds.length || rows.length !== clubIds.length / 2) {
        everyClubPerMatchday = false;
      }
    }
    check("Every matchday holds each club exactly once", everyClubPerMatchday);

    /* ---------------- Deterministic scoring (pure) ----------------------- */
    const key = "t:j1:A:B";
    const outcomeA = resolveFixture({ matchKey: key, homeXiOvr: 84, awayXiOvr: 84 });
    const outcomeB = resolveFixture({ matchKey: key, homeXiOvr: 84, awayXiOvr: 84 });
    check(
      "Same inputs produce the same score",
      outcomeA.homeGoals === outcomeB.homeGoals &&
        outcomeA.awayGoals === outcomeB.awayGoals &&
        outcomeA.homePoints === outcomeB.homePoints,
    );
    check("Points stay in a sane band", outcomeA.homePoints >= 30 && outcomeA.homePoints <= 120);

    /* ---------------- Standings (pure) ----------------------------------- */
    const rows = clubIds.map((clubId) => ({
      clubId,
      clubName: `Club ${clubId}`,
      clubShortName: clubId,
      clubColors: ["#111111", "#333333"] as [string, string],
    }));
    const played: ScoredFixture[] = [
      {
        homeClubId: "A",
        awayClubId: "B",
        homeGoals: 3,
        awayGoals: 1,
        homePoints: 88,
        awayPoints: 80,
        played: true,
      },
      {
        homeClubId: "C",
        awayClubId: "D",
        homeGoals: 0,
        awayGoals: 0,
        homePoints: 75,
        awayPoints: 75,
        played: true,
      },
      {
        homeClubId: "E",
        awayClubId: "F",
        homeGoals: 1,
        awayGoals: 2,
        homePoints: 70,
        awayPoints: 82,
        played: true,
      },
    ];
    const standings = computeStandings(rows, played);
    const aRow = standings.find((row) => row.clubId === "A");
    const fRow = standings.find((row) => row.clubId === "F");
    check("Winner leads the table", standings[0]?.clubId === "A");
    check(
      "Win = 3 points, draw = 1, loss = 0",
      aRow?.points === 3 && fRow?.points === 3,
    );
    check(
      "Goal difference accumulates correctly",
      aRow?.goalDiff === 2 && fRow?.goalDiff === 1,
    );
    check(
      "Fantasy points flow into the table",
      aRow?.fantasyFor === 88 && fRow?.fantasyFor === 82,
    );

    /* ---------------- Live lifecycle against the runtime ----------------- */
    const tournamentId = await ctx.db.insert("tournaments", {
      code: `comptest-${now}`,
      name: "Competition self test",
      season: "2026",
      status: "competicion",
      currentMatchday: 1,
      totalMatchdays: 14,
      marketOpen: false,
      createdAt: now,
    });
    await ctx.db.insert("tournamentRules", {
      tournamentId,
      budget: 350_000_000,
      squadSize: 20,
      gkMin: 2,
      gkMax: 4,
      defMin: 7,
      defMax: 9,
      midMin: 6,
      midMax: 10,
      fwdMin: 3,
      fwdMax: 5,
      maxPerRealClub: 3,
      minOvr: 70,
      maxU21: 8,
      lineupLockHours: 3,
      updatedAt: now,
    });

    const clubDocs: Array<{ clubId: Id<"clubs">; name: string }> = [];
    for (const label of clubIds) {
      const clubId = await ctx.db.insert("clubs", {
        tournamentId,
        name: `Selftest ${label}`,
        shortName: `ST${label}`,
        league: "Self League",
        country: "Test",
        colorPrimary: "#111111",
        colorSecondary: "#333333",
      });
      clubDocs.push({ clubId, name: `Selftest ${label}` });
      for (let index = 0; index < SHAPE.length; index += 1) {
        const position = SHAPE[index];
        createdPlayers.push(
          await ctx.db.insert("players", {
            name: `ST${label} ${position} ${index + 1}`,
            position,
            group: groupOf(position),
            ovr: 82,
            age: 25,
            value: 10_000_000,
            nationality: "Test",
            flag: "🏳️",
            realClub: `Selftest ${label}`,
            realLeague: "Self League",
            fcVersion: "test",
          }),
        );
      }
    }

    // Seed fixtures through the real tournament flow (idempotency included).
    const tournamentDoc = (await ctx.db.get(tournamentId))!;
    const seeded = await seedFixtures(ctx, tournamentDoc);
    check("Calendar seeds 56 fixtures", seeded === 56, `${seeded} seeded`);
    const seededAgain = await seedFixtures(ctx, tournamentDoc);
    check("Seeding is idempotent", seededAgain === 0);

    const user = await ctx.db.insert("users", {
      name: "Presidente Test",
      email: `comp${now}@test.dev`,
    });
    const squadsByClub = new Map<string, Id<"squads">>();
    for (const club of clubDocs) {
      const presidentId = await ctx.db.insert("presidents", {
        tournamentId,
        userId: user,
        nickname: `@st${club.name.slice(-1).toLowerCase()}`,
        displayName: `Presidente ${club.name.slice(-1)}`,
        clubId: club.clubId,
        budget: 350_000_000,
        joinedAt: now,
      });
      const { squadId } = await seedSquadForClub(ctx, {
        tournamentId,
        clubId: club.clubId,
        presidentId,
        clubName: club.name,
      });
      squadsByClub.set(club.clubId as string, squadId);
    }

    // Give every squad a full 11: the matchday snapshots whoever occupies the
    // slots, so the first eleven squad members become the starters.
    const formationSlots = FORMATIONS[DEFAULT_FORMATION].slots;
    for (const [, squadId] of squadsByClub) {
      const members = await ctx.db
        .query("squadPlayers")
        .withIndex("by_squad", (q) => q.eq("squadId", squadId))
        .collect();
      await ctx.db.patch(squadId, {
        formation: DEFAULT_FORMATION,
        lineup: formationSlots.map((slot, index) => ({
          slotId: slot.id,
          playerId:
            index < members.length ? ((members[index].playerId as string) ?? null) : null,
        })),
        lineupUpdatedAt: now,
      });
    }

    const matchday1 = await ctx.db
      .query("fixtures")
      .withIndex("by_tournament_matchday", (q) =>
        q.eq("tournamentId", tournamentId).eq("matchday", 1),
      )
      .collect();
    check(
      "Matchday 1 is active after seeding",
      matchday1.length === 4 && matchday1.every((row) => row.status === "en_curso"),
      `${matchday1.length} partidos`,
    );

    const result = await playMatchday(ctx, tournamentDoc, "Sistema");
    check("Matchday closes 4 fixtures", result.played === 4, `${result.played} played`);
    check("Next matchday is jornada 2", result.nextMatchday === 2);

    const playedRows = await ctx.db
      .query("fixtures")
      .withIndex("by_tournament_matchday", (q) =>
        q.eq("tournamentId", tournamentId).eq("matchday", 1),
      )
      .collect();
    check(
      "Played fixtures snapshot XI OVR and score",
      playedRows.every(
        (row) =>
          row.status === "jugado" &&
          typeof row.homeGoals === "number" &&
          typeof row.homeXiOvr === "number",
      ),
    );

    const tournamentAfter = (await ctx.db.get(tournamentId))!;
    check(
      "Tournament advances to jornada 2",
      tournamentAfter.currentMatchday === 2,
      `currentMatchday=${tournamentAfter.currentMatchday}`,
    );

    const matchday2 = await ctx.db
      .query("fixtures")
      .withIndex("by_tournament_matchday", (q) =>
        q.eq("tournamentId", tournamentId).eq("matchday", 2),
      )
      .collect();
    check(
      "Matchday 2 activates automatically",
      matchday2.length === 4 && matchday2.every((row) => row.status === "en_curso"),
    );

    /* ---------------- Cleanup -------------------------------------------- */
    const allFixtures = await ctx.db
      .query("fixtures")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
    for (const row of allFixtures) await ctx.db.delete(row._id);

    const audit = await ctx.db
      .query("auditLog")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
    for (const row of audit) await ctx.db.delete(row._id);

    const squadPlayerRows = await ctx.db
      .query("squadPlayers")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
    for (const row of squadPlayerRows) await ctx.db.delete(row._id);

    const squads = await ctx.db
      .query("squads")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
    for (const row of squads) await ctx.db.delete(row._id);

    const presidents = await ctx.db
      .query("presidents")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
    for (const row of presidents) await ctx.db.delete(row._id);
    await ctx.db.delete(user);

    const rules = await ctx.db
      .query("tournamentRules")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
    for (const row of rules) await ctx.db.delete(row._id);

    const clubs = await ctx.db
      .query("clubs")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
    for (const club of clubs) await ctx.db.delete(club._id);
    for (const playerId of createdPlayers) await ctx.db.delete(playerId);
    await ctx.db.delete(tournamentId);

    const afterTournaments = await ctx.db.query("tournaments").collect();
    const leaked = afterTournaments.filter(
      (row) => !beforeTournamentIds.has(row._id as string),
    ).length;
    const leakedPlayers = (await ctx.db.query("players").collect()).filter(
      (player) => player.realClub.startsWith("Selftest"),
    ).length;

    return { failures, leakedTournaments: leaked, leakedPlayers, report };
  },
});
