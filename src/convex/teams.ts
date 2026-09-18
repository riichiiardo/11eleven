import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getTournament, loadSquadPlayers } from "./context";
import {
  DEFAULT_FORMATION,
  computeSquadStats,
  emptyLineup,
  isFormationCode,
  type FormationCode,
} from "./rulesEngine";
import type { TeamSquadView } from "./appTypes";

/**
 * Equipos (prompt IA: EQUIPOS → Plantillas → Comparar): any signed-in President
 * can inspect the squad and XI of every club in the tournament.
 */
export const squadOf = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }): Promise<TeamSquadView | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Inicia sesión para consultar las plantillas.");
    }
    const tournament = await getTournament(ctx);
    if (!tournament) {
      throw new ConvexError("El torneo no está disponible.");
    }

    const club = await ctx.db.get(clubId);
    if (!club || club.tournamentId !== tournament._id) return null;

    const squadDoc = await ctx.db
      .query("squads")
      .withIndex("by_club", (q) => q.eq("clubId", clubId))
      .first();
    const squad = squadDoc ? await loadSquadPlayers(ctx, squadDoc._id) : [];

    const formation: FormationCode =
      squadDoc && isFormationCode(squadDoc.formation)
        ? squadDoc.formation
        : DEFAULT_FORMATION;
    const lineup =
      squadDoc && squadDoc.lineup.length > 0
        ? {
            formation,
            slots: squadDoc.lineup.map((slot) => ({
              slotId: slot.slotId,
              playerId: slot.playerId ?? null,
            })),
          }
        : emptyLineup(formation);

    const byId = new Map(squad.map((player) => [player.playerId as string, player]));
    const xi: TeamSquadView["xi"] = [];
    for (const slot of lineup.slots) {
      if (!slot.playerId) continue;
      const player = byId.get(slot.playerId);
      if (!player) continue;
      xi.push({
        slotId: slot.slotId,
        playerId: player.playerId,
        name: player.name,
        position: player.position,
        group: player.group,
        ovr: player.ovr,
        flag: player.flag,
      });
    }

    return {
      clubId: club._id,
      clubName: club.name,
      clubShortName: club.shortName,
      clubColors: [club.colorPrimary, club.colorSecondary],
      squad,
      stats: computeSquadStats(squad),
      formation,
      xiOvr: xi.length
        ? Math.round(xi.reduce((sum, player) => sum + player.ovr, 0) / xi.length)
        : 0,
      xi,
    };
  },
});
