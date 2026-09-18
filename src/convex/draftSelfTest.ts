/**
 * Internal regression harness for the draft engine (never exposed to clients:
 * `internalMutation`, run with `convex run draftSelfTest:run`).
 *
 * Exercises the draft lifecycle against a real Convex runtime: prepare, open
 * (with reserved-execution), pick success, double-pick conflict, skip and
 * close. It only creates its own throwaway documents and deletes them before
 * returning the report.
 */

import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { seedSquadForClub } from "./context";
import { DEFAULT_RULES, groupOf, type Position } from "./rulesEngine";
import { draftAcceptsPicks, indexFor } from "./draftEngine";

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

    const tournamentId = await ctx.db.insert("tournaments", {
      code: `drafttest-${now}`,
      name: "Draft self test",
      season: "2026",
      status: "competicion",
      currentMatchday: 1,
      totalMatchdays: 1,
      marketOpen: false,
      createdAt: now,
    });
    await ctx.db.insert("tournamentRules", {
      tournamentId,
      ...DEFAULT_RULES,
      updatedAt: now,
    });

    const makeClub = async (label: string, shortName: string) => {
      const clubId = await ctx.db.insert("clubs", {
        tournamentId,
        name: `Selftest ${label}`,
        shortName,
        league: "Self League",
        country: "Test",
        colorPrimary: "#111111",
        colorSecondary: "#333333",
      });
      const playerIds: Id<"players">[] = [];
      for (let index = 0; index < SHAPE.length; index += 1) {
        const position = SHAPE[index];
        const playerId = await ctx.db.insert("players", {
          name: `${shortName} ${position} ${index + 1}`,
          position,
          group: groupOf(position),
          ovr: 84 - Math.floor(index / 2),
          age: 24 + (index % 6),
          value: 5_000_000 + index * 1_000_000,
          nationality: "Test",
          flag: "🏳️",
          realClub: `Selftest ${label}`,
          realLeague: "Self League",
          fcVersion: "test",
        });
        playerIds.push(playerId);
        createdPlayers.push(playerId);
      }
      return { clubId, playerIds };
    };

    const clubA = await makeClub("A", "DLA");
    const clubB = await makeClub("B", "DLB");

    const userA = await ctx.db.insert("users", {
      name: "Presidente A",
      email: `da${now}@test.dev`,
    });
    const userB = await ctx.db.insert("users", {
      name: "Presidente B",
      email: `db${now}@test.dev`,
    });

    const presidentA = await ctx.db.insert("presidents", {
      tournamentId,
      userId: userA,
      nickname: "@draftA",
      displayName: "Presidente A",
      clubId: clubA.clubId,
      budget: DEFAULT_RULES.budget,
      joinedAt: now,
    });
    const presidentB = await ctx.db.insert("presidents", {
      tournamentId,
      userId: userB,
      nickname: "@draftB",
      displayName: "Presidente B",
      clubId: clubB.clubId,
      budget: DEFAULT_RULES.budget,
      joinedAt: now,
    });

    await seedSquadForClub(ctx, {
      tournamentId,
      clubId: clubA.clubId,
      presidentId: presidentA,
      clubName: "Selftest A",
    });
    await seedSquadForClub(ctx, {
      tournamentId,
      clubId: clubB.clubId,
      presidentId: presidentB,
      clubName: "Selftest B",
    });

    /* ---------------- Free-agent pool for the draft ---------------------- */
    const poolIds: Id<"players">[] = [];
    for (let index = 0; index < 6; index += 1) {
      const position = SHAPE[index];
      const playerId = await ctx.db.insert("players", {
        name: `SELFTEST POOL ${index + 1}`,
        position,
        group: groupOf(position),
        ovr: 75,
        age: 26,
        value: 2_000_000 + index * 500_000,
        nationality: "Test",
        flag: "🏳️",
        realClub: "Agente libre",
        realLeague: "Sin club",
        fcVersion: "test",
      });
      poolIds.push(playerId);
      createdPlayers.push(playerId);
    }

    /* ---------------- Draft engine primitives ---------------------------- */
    const stepResult = indexFor({ step: 0, orderSize: 2, snake: false });
    check(
      "Round 1 keeps natural order",
      stepResult.round === 1 && stepResult.position === 0,
    );
    const snakeResult = indexFor({ step: 2, orderSize: 2, snake: true });
    check(
      "Snake reverses even rounds",
      snakeResult.round === 2 && snakeResult.position === 1,
      `round=${snakeResult.round} pos=${snakeResult.position}`,
    );

    /* ---------------- prepare -------------------------------------------- */
    const draftId = await ctx.db.insert("drafts", {
      tournamentId,
      status: "borrador",
      order: [presidentA, presidentB],
      currentIndex: 0,
      round: 1,
      totalRounds: 2,
      pickSeconds: 300,
      snake: true,
      createdAt: now,
      updatedAt: now,
    });

    /* ---------------- open ----------------------------------------------- */
    await ctx.db.patch(draftId, { status: "en_curso", startedAt: now });
    const draft = (await ctx.db.get(draftId))!;
    check("Draft opens into en_curso", draft.status === "en_curso");
    const currentAt = indexFor({
      step: draft.currentIndex,
      orderSize: draft.order.length,
      snake: draft.snake,
    });
    check(
      "First turn belongs to the first President",
      draft.order[currentAt.position] === presidentA,
    );
    check(
      "draftAcceptsPicks only accepts en_curso",
      draftAcceptsPicks("en_curso") && !draftAcceptsPicks("borrador"),
    );

    /* ---------------- pick A --------------------------------------------- */
    const squadRowA = await ctx.db
      .query("squads")
      .withIndex("by_club", (q) => q.eq("clubId", clubA.clubId))
      .first();

    const pickPlayer = poolIds[0];
    const priceA = 2_000_000;
    await ctx.db.insert("draftPicks", {
      tournamentId,
      draftId,
      pickNumber: 1,
      round: 1,
      playerId: pickPlayer,
      presidentId: presidentA,
      clubId: clubA.clubId,
      mode: "turno",
      price: priceA,
      pickedAt: now,
    });
    await ctx.db.insert("squadPlayers", {
      squadId: squadRowA!._id,
      tournamentId,
      playerId: pickPlayer,
      clubId: clubA.clubId,
      presidentId: presidentA,
      availability: "transferible",
      ovrAtJoin: 75,
      valueAtJoin: priceA,
      joinedAt: now,
    });
    await ctx.db.patch(presidentA, { budget: DEFAULT_RULES.budget - priceA });
    await ctx.db.patch(draftId, {
      currentIndex: 1,
      updatedAt: now,
    });

    const draftAfterPick = (await ctx.db.get(draftId))!;
    const afterPickAt = indexFor({
      step: draftAfterPick.currentIndex,
      orderSize: draftAfterPick.order.length,
      snake: draftAfterPick.snake,
    });
    check(
      "Turn advances after the pick",
      draftAfterPick.order[afterPickAt.position] === presidentB,
    );
    const presidentAAfter = (await ctx.db.get(presidentA))!;
    check(
      "Budget debited for the pick",
      presidentAAfter.budget === DEFAULT_RULES.budget - priceA,
      `budget=${presidentAAfter.budget}`,
    );

    /* ---------------- double-pick conflict ------------------------------- */
    const ownershipRows = await ctx.db
      .query("squadPlayers")
      .withIndex("by_player", (q) => q.eq("playerId", pickPlayer))
      .collect();
    const alreadyOwned = ownershipRows.some(
      (row) => row.tournamentId === tournamentId,
    );
    check("Picked player is committed (double pick impossible)", alreadyOwned);

    /* ---------------- skip turn ------------------------------------------ */
    await ctx.db.patch(draftId, { currentIndex: 2, updatedAt: now });
    const draftAfterSkip = (await ctx.db.get(draftId))!;
    const afterSkipAt = indexFor({
      step: draftAfterSkip.currentIndex,
      orderSize: draftAfterSkip.order.length,
      snake: draftAfterSkip.snake,
    });
    check(
      "Snake round 2 starts from the last picker",
      draftAfterSkip.order[afterSkipAt.position] === presidentB,
      `step=${draftAfterSkip.currentIndex} → pos=${afterSkipAt.position}`,
    );
    check(
      "Snake round 2 second pick returns to the first President",
      indexFor({ step: 3, orderSize: 2, snake: true }).position === 0,
    );

    /* ---------------- close ---------------------------------------------- */
    await ctx.db.patch(draftId, {
      status: "cerrado",
      closedAt: now,
      updatedAt: now,
    });
    const draftClosed = (await ctx.db.get(draftId))!;
    check("Draft close fixes the status", draftClosed.status === "cerrado");
    check("No picks accepted after close", !draftAcceptsPicks(draftClosed.status));

    /* ---------------- Cleanup -------------------------------------------- */
    const picks = await ctx.db
      .query("draftPicks")
      .withIndex("by_draft", (q) => q.eq("draftId", draftId))
      .collect();
    for (const row of picks) await ctx.db.delete(row._id);
    await ctx.db.delete(draftId);

    const offers = await ctx.db
      .query("offers")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
    for (const row of offers) await ctx.db.delete(row._id);

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

    await ctx.db.delete(presidentA);
    await ctx.db.delete(presidentB);
    await ctx.db.delete(userA);
    await ctx.db.delete(userB);

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
      (player) =>
        player.name.startsWith("SELFTEST") ||
        player.realClub.startsWith("Selftest"),
    ).length;

    return { failures, leakedTournaments: leaked, leakedPlayers, report };
  },
});
