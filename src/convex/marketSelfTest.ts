/**
 * Internal regression harness for the transaction engine (never exposed to
 * clients: `internalMutation`, run with `convex run marketSelfTest:run`).
 *
 * Exercises the market lifecycle against a real Convex runtime inside one
 * transaction: free-agent signing, reserved trade, double-commitment conflict,
 * budget block and position-minimum block. It only creates its own throwaway
 * documents and deletes them before returning the report.
 */

import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { createSquadForClub } from "./context";
import { DEFAULT_RULES, groupOf, type Position } from "./rulesEngine";
import { tryExecute, validateOfferExecution } from "./market";

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
      code: `selftest-${now}`,
      name: "Self test",
      season: "2026",
      status: "competicion",
      currentMatchday: 1,
      totalMatchdays: 1,
      marketOpen: true,
      createdAt: now,
    });
    await ctx.db.insert("tournamentRules", {
      tournamentId,
      ...DEFAULT_RULES,
      updatedAt: now,
    });

    const makeClub = async (label: string, shortName: string, baseOvr: number) => {
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
          ovr: baseOvr - Math.floor(index / 2),
          age: index < 2 ? 20 : 24 + (index % 6),
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

    // Own free agents so the real pool of the deployment is never touched.
    const freeAgentIds: Id<"players">[] = [];
    for (let index = 0; index < 4; index += 1) {
      const position = SHAPE[index];
      const playerId = await ctx.db.insert("players", {
        name: `SELFTEST FREE ${index + 1}`,
        position,
        group: groupOf(position),
        ovr: 74,
        age: 27,
        value: 1_000_000 + index * 500_000,
        nationality: "Test",
        flag: "🏳️",
        realClub: "Agente libre",
        realLeague: "Sin club",
        fcVersion: "test",
      });
      freeAgentIds.push(playerId);
      createdPlayers.push(playerId);
    }

    const clubA = await makeClub("A", "SLA", 85);
    const clubB = await makeClub("B", "SLB", 82);

    const userA = await ctx.db.insert("users", {
      name: "Presidente A",
      email: `a${now}@test.dev`,
    });
    const userB = await ctx.db.insert("users", {
      name: "Presidente B",
      email: `b${now}@test.dev`,
    });

    const presidentA = await ctx.db.insert("presidents", {
      tournamentId,
      userId: userA,
      nickname: "@presiA",
      displayName: "Presidente A",
      clubId: clubA.clubId,
      budget: DEFAULT_RULES.budget,
      joinedAt: now,
    });
    const presidentB = await ctx.db.insert("presidents", {
      tournamentId,
      userId: userB,
      nickname: "@presiB",
      displayName: "Presidente B",
      clubId: clubB.clubId,
      budget: DEFAULT_RULES.budget,
      joinedAt: now,
    });

    const squadA = await createSquadForClub(ctx, {
      tournamentId,
      clubId: clubA.clubId,
      presidentId: presidentA,
      clubName: "Selftest A",
    });
    const squadB = await createSquadForClub(ctx, {
      tournamentId,
      clubId: clubB.clubId,
      presidentId: presidentB,
      clubName: "Selftest B",
    });

    const squadRow = async (clubId: Id<"clubs">) =>
      (await ctx.db
        .query("squads")
        .withIndex("by_club", (q) => q.eq("clubId", clubId))
        .first())!;

    const ownershipOf = async (playerId: Id<"players">) => {
      const rows = await ctx.db
        .query("squadPlayers")
        .withIndex("by_player", (q) => q.eq("playerId", playerId))
        .collect();
      return rows.find((row) => row.tournamentId === tournamentId) ?? null;
    };

    check("Squad A created", squadA.size === 20, `size=${squadA.size}`);
    check("Squad B created", squadB.size === 20, `size=${squadB.size}`);

    /* ---------------- 1. Free-agent signing executes immediately ----------- */
    const freeAgent = freeAgentIds[0];
    const freeOfferId = await ctx.db.insert("offers", {
      tournamentId,
      type: "cash",
      bidderPresidentId: presidentA,
      bidderClubId: clubA.clubId,
      requestedPlayerIds: [freeAgent],
      offeredPlayerIds: [],
      cash: 1_000_000,
      status: "aceptada",
      createdAt: now,
      updatedAt: now,
      agreedAt: now,
    });
    const freeOutcome = await tryExecute(
      ctx,
      freeOfferId,
      (await ctx.db.get(presidentA))!,
      userA,
    );
    const freeOwnership = await ownershipOf(freeAgent);
    const presidentAAfter = await ctx.db.get(presidentA);
    check("Free-agent signing executed", freeOutcome.executed, freeOutcome.message);
    check("Free agent now belongs to club A", freeOwnership?.clubId === clubA.clubId);
    check(
      "Presupuesto descontado",
      presidentAAfter?.budget === DEFAULT_RULES.budget - 1_000_000,
      `budget=${presidentAAfter?.budget}`,
    );

    /* ---------------- 2. Reserved same-position swap executes ------------- */
    const squadBRow = await squadRow(clubB.clubId);
    const starterSlot = squadBRow.lineup.find((slot) => slot.playerId);
    const targetB = starterSlot?.playerId as Id<"players">;
    const targetPlayer = (await ctx.db.get(targetB))!;
    let offeredA: Id<"players"> | null = null;
    for (const candidate of clubA.playerIds) {
      const player = await ctx.db.get(candidate);
      if (player?.position === targetPlayer.position) {
        offeredA = candidate;
        break;
      }
    }
    if (!offeredA) {
      throw new Error(`No counter-player found for ${targetPlayer.position}`);
    }
    const offeredAPlayer = (await ctx.db.get(offeredA))!;
    check(
      "Trade fixture is a same-position swap",
      offeredAPlayer.group === targetPlayer.group,
      `${offeredAPlayer.position} ↔ ${targetPlayer.position}`,
    );

    const tradeOfferId = await ctx.db.insert("offers", {
      tournamentId,
      type: "trade",
      bidderPresidentId: presidentA,
      bidderClubId: clubA.clubId,
      sellerPresidentId: presidentB,
      sellerClubId: clubB.clubId,
      requestedPlayerIds: [targetB],
      offeredPlayerIds: [offeredA],
      cash: 20_000_000,
      status: "reservada",
      createdAt: now,
      updatedAt: now,
      agreedAt: now,
    });

    const validation = await validateOfferExecution(
      ctx,
      (await ctx.db.get(tradeOfferId))!,
    );
    check(
      "Reserved trade passes final validation",
      validation.passed,
      validation.reasons[0] ?? "",
    );

    const tradeOutcome = await tryExecute(
      ctx,
      tradeOfferId,
      (await ctx.db.get(presidentA))!,
      userA,
    );
    const acquired = await ownershipOf(targetB);
    const givenAway = await ownershipOf(offeredA);
    const presidentBAfter = await ctx.db.get(presidentB);
    const squadBAfter = await squadRow(clubB.clubId);
    const squadAAfter = await squadRow(clubA.clubId);

    check("Reserved trade executed", tradeOutcome.executed, tradeOutcome.message);
    check("Requested player joined club A", acquired?.clubId === clubA.clubId);
    check("Offered player joined club B", givenAway?.clubId === clubB.clubId);
    check(
      "Cash moved to the seller",
      presidentBAfter?.budget === DEFAULT_RULES.budget + 20_000_000,
      `budget=${presidentBAfter?.budget}`,
    );
    check(
      "Departed starter removed from the seller lineup",
      !squadBAfter.lineup.some((slot) => slot.playerId === targetB),
    );
    check(
      "Acquired player is not injected into the buyer XI",
      !squadAAfter.lineup.some((slot) => slot.playerId === targetB),
    );

    /* ---------------- 3. Double commitment is invalidated ----------------- */
    const contested = clubB.playerIds[4];
    const first = await ctx.db.insert("offers", {
      tournamentId,
      type: "cash",
      bidderPresidentId: presidentA,
      bidderClubId: clubA.clubId,
      sellerPresidentId: presidentB,
      sellerClubId: clubB.clubId,
      requestedPlayerIds: [contested],
      offeredPlayerIds: [],
      cash: 5_000_000,
      status: "reservada",
      createdAt: now,
      updatedAt: now,
      agreedAt: now,
    });
    const second = await ctx.db.insert("offers", {
      tournamentId,
      type: "cash",
      bidderPresidentId: presidentA,
      bidderClubId: clubA.clubId,
      sellerPresidentId: presidentB,
      sellerClubId: clubB.clubId,
      requestedPlayerIds: [contested],
      offeredPlayerIds: [],
      cash: 6_000_000,
      status: "reservada",
      createdAt: now,
      updatedAt: now,
      agreedAt: now,
    });
    const firstOutcome = await tryExecute(
      ctx,
      first,
      (await ctx.db.get(presidentA))!,
      userA,
    );
    const secondOutcome = await tryExecute(
      ctx,
      second,
      (await ctx.db.get(presidentA))!,
      userA,
    );
    const secondRow = await ctx.db.get(second);
    check("First operation of the conflict executes", firstOutcome.executed);
    check(
      "Second operation over the same player is rejected",
      !secondOutcome.executed,
    );
    check(
      "Second operation is invalidada with a human reason",
      secondRow?.status === "invalidada" && (secondRow?.invalidReason ?? "").length > 20,
      secondRow?.invalidReason ?? "sin motivo",
    );
    check(
      "Invalidation reason names the player",
      (secondRow?.invalidReason ?? "").includes((await ctx.db.get(contested))!.name),
    );

    /* ---------------- 4. Budget rule blocks execution --------------------- */
    const impossible = await ctx.db.insert("offers", {
      tournamentId,
      type: "cash",
      bidderPresidentId: presidentA,
      bidderClubId: clubA.clubId,
      sellerPresidentId: presidentB,
      sellerClubId: clubB.clubId,
      requestedPlayerIds: [clubB.playerIds[6]],
      offeredPlayerIds: [],
      cash: 900_000_000,
      status: "reservada",
      createdAt: now,
      updatedAt: now,
      agreedAt: now,
    });
    const impossibleValidation = await validateOfferExecution(
      ctx,
      (await ctx.db.get(impossible))!,
    );
    check(
      "Budget rule blocks the operation",
      !impossibleValidation.passed &&
        impossibleValidation.reasons.some((reason) =>
          reason.toLowerCase().includes("presupuesto"),
        ),
      impossibleValidation.reasons[0] ?? "",
    );

    /* ---------------- 5. Position minimum blocks the deal ----------------- */
    const sellerKeeper = clubB.playerIds[0];
    const keeperPlayer = (await ctx.db.get(sellerKeeper))!;
    const keeperCash = await ctx.db.insert("offers", {
      tournamentId,
      type: "cash",
      bidderPresidentId: presidentA,
      bidderClubId: clubA.clubId,
      sellerPresidentId: presidentB,
      sellerClubId: clubB.clubId,
      requestedPlayerIds: [sellerKeeper],
      offeredPlayerIds: [],
      cash: 3_000_000,
      status: "reservada",
      createdAt: now,
      updatedAt: now,
      agreedAt: now,
    });
    const keeperCashValidation = await validateOfferExecution(
      ctx,
      (await ctx.db.get(keeperCash))!,
    );
    check(
      "Position minimum blocks taking the last keeper",
      !keeperCashValidation.passed &&
        keeperCashValidation.reasons.some((reason) =>
          reason.toLowerCase().includes("porteros"),
        ),
      `${keeperPlayer.name}: ${keeperCashValidation.reasons[0] ?? ""}`,
    );

    const keeperSwap = await ctx.db.insert("offers", {
      tournamentId,
      type: "trade",
      bidderPresidentId: presidentA,
      bidderClubId: clubA.clubId,
      sellerPresidentId: presidentB,
      sellerClubId: clubB.clubId,
      requestedPlayerIds: [sellerKeeper],
      offeredPlayerIds: [clubA.playerIds[0]],
      cash: 2_000_000,
      status: "reservada",
      createdAt: now,
      updatedAt: now,
      agreedAt: now,
    });
    const keeperSwapValidation = await validateOfferExecution(
      ctx,
      (await ctx.db.get(keeperSwap))!,
    );
    check(
      "Keeper-for-keeper swap passes (minimums respected)",
      keeperSwapValidation.passed,
      keeperSwapValidation.reasons[0] ?? "",
    );
    const keeperSwapOutcome = await tryExecute(
      ctx,
      keeperSwap,
      (await ctx.db.get(presidentA))!,
      userA,
    );
    check("Keeper swap executed", keeperSwapOutcome.executed, keeperSwapOutcome.message);

    /* ---------------- Cleanup -------------------------------------------- */
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

    await ctx.db.delete(squadA.squadId);
    await ctx.db.delete(squadB.squadId);
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
    const leakedPlayers = (await ctx.db.query("players").collect()).filter((player) =>
      player.name.startsWith("SELFTEST") || player.realClub.startsWith("Selftest"),
    ).length;

    return {
      failures,
      leakedTournaments: leaked,
      leakedPlayers,
      report,
    };
  },
});
