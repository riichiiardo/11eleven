import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  getTournament,
  loadPresident,
  loadRules,
  loadSquadPlayers,
  logAudit,
} from "./context";
import {
  AVAILABILITY_META,
  FORMATIONS,
  autoLineup,
  evaluateLineup,
  evaluateSquadRules,
  isFormationCode,
  type Lineup,
  type PlayerAvailability,
} from "./rulesEngine";

async function loadMySquad(ctx: MutationCtx, userId: Id<"users">) {
  const tournament = await getTournament(ctx);
  if (!tournament) {
    throw new ConvexError("El torneo no está disponible.");
  }
  const president = await loadPresident(ctx, tournament._id, userId);
  if (!president) {
    throw new ConvexError(
      "Aún no presides ningún club. Selecciona tu club para gestionar la plantilla.",
    );
  }
  const squad = await ctx.db
    .query("squads")
    .withIndex("by_club", (q) => q.eq("clubId", president.clubId))
    .first();
  if (!squad) {
    throw new ConvexError(
      "Tu club todavía no tiene plantilla registrada. Contacta a Administración.",
    );
  }
  const squadPlayers = await loadSquadPlayers(ctx, squad._id);
  const club = await ctx.db.get(president.clubId);
  return { tournament, president, squad, squadPlayers, clubName: club?.name };
}

/* ------------------------------------------------------------------ *
 * Availability — how the rest of the Presidents see your squad
 * ------------------------------------------------------------------ */

export const setAvailability = mutation({
  args: {
    playerId: v.id("players"),
    availability: v.union(
      v.literal("transferible"),
      v.literal("negociacion"),
      v.literal("neutro"),
      v.literal("intransferible"),
    ),
  },
  handler: async (ctx, { playerId, availability }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Inicia sesión para gestionar tu plantilla.");

    const { tournament, president, squadPlayers } = await loadMySquad(ctx, userId);
    const target = squadPlayers.find((player) => player.playerId === playerId);
    if (!target) {
      throw new ConvexError(
        "Ese jugador no pertenece a tu plantilla. Solo puedes gestionar tus propios jugadores.",
      );
    }

    await ctx.db.patch(target.squadPlayerId, {
      availability: availability as PlayerAvailability,
    });

    const user = await ctx.db.get(userId);
    const meta = AVAILABILITY_META[availability as PlayerAvailability];
    await logAudit(ctx, {
      tournamentId: tournament._id,
      clubId: president.clubId,
      actorUserId: userId,
      actorName: user?.name ?? president.displayName,
      action: "Situación de jugador actualizada",
      entity: "squadPlayer",
      entityId: target.squadPlayerId,
      detail: `${target.name} pasa a ${meta.label} (${meta.symbol})`,
    });

    return { availability };
  },
});

/* ------------------------------------------------------------------ *
 * Lineup
 * ------------------------------------------------------------------ */

const lineupArgs = {
  formation: v.string(),
  slots: v.array(
    v.object({
      slotId: v.string(),
      playerId: v.union(v.string(), v.null()),
    }),
  ),
};

function buildLineup(
  formation: string,
  slots: Array<{ slotId: string; playerId: string | null }>,
  squadPlayerIds: Set<string>,
): Lineup {
  if (!isFormationCode(formation)) {
    throw new ConvexError(
      "Esa formación no está disponible en el torneo. Elige una de las formaciones habilitadas.",
    );
  }
  const definition = FORMATIONS[formation];
  const known = new Set(definition.slots.map((slot) => slot.id));

  const normalized = definition.slots.map((slot) => {
    const provided = slots.find((item) => item.slotId === slot.id);
    const playerId = provided?.playerId ?? null;
    if (playerId && !squadPlayerIds.has(playerId)) {
      throw new ConvexError(
        "Uno de los jugadores del once no pertenece a tu plantilla. Actualiza la página y vuelve a intentarlo.",
      );
    }
    return { slotId: slot.id, playerId };
  });

  const unknown = slots.filter((slot) => !known.has(slot.slotId));
  if (unknown.length > 0) {
    throw new ConvexError(
      "La formación enviada incluye posiciones que no existen en este esquema.",
    );
  }

  return { formation, slots: normalized };
}

export const saveLineup = mutation({
  args: lineupArgs,
  handler: async (ctx, { formation, slots }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Inicia sesión para guardar tu alineación.");

    const { tournament, president, squad, squadPlayers, clubName } =
      await loadMySquad(ctx, userId);
    const rules = await loadRules(ctx, tournament._id);
    const squadPlayerIds = new Set(squadPlayers.map((player) => player.playerId));

    const lineup = buildLineup(formation, slots, squadPlayerIds);
    const evaluation = evaluateSquadRules(
      rules,
      squadPlayers,
      president.budget,
      clubName,
    );
    const lineupEvaluation = evaluateLineup(
      rules,
      squadPlayers,
      lineup,
      evaluation,
    );

    if (!lineupEvaluation.valid) {
      const blocker = lineupEvaluation.checks.find((check) => !check.passed);
      throw new ConvexError(
        blocker?.detail ??
          "La alineación no cumple las reglas del torneo. Revisa el panel de validación.",
      );
    }

    await ctx.db.patch(squad._id, {
      formation,
      lineup: lineup.slots,
      lineupUpdatedAt: Date.now(),
    });

    const user = await ctx.db.get(userId);
    await logAudit(ctx, {
      tournamentId: tournament._id,
      clubId: president.clubId,
      actorUserId: userId,
      actorName: user?.name ?? president.displayName,
      action: "Alineación guardada",
      entity: "squad",
      entityId: squad._id,
      detail: `${formationLabel(formation)} · ${lineupEvaluation.starters.length} titulares · OVR medio del once ${
        lineupEvaluation.starters.length
          ? Math.round(
              (lineupEvaluation.starters.reduce((sum, p) => sum + p.ovr, 0) /
                lineupEvaluation.starters.length) *
                10,
            ) / 10
          : 0
      }`,
    });

    return { saved: true, formation };
  },
});

function formationLabel(formation: string): string {
  return isFormationCode(formation) ? FORMATIONS[formation].label : formation;
}

/** One-click legal XI built by the same engine that validates it. */
export const autoFillLineup = mutation({
  args: { formation: v.string() },
  handler: async (ctx, { formation }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Inicia sesión para gestionar tu alineación.");

    const { tournament, president, squad, squadPlayers, clubName } =
      await loadMySquad(ctx, userId);
    if (!isFormationCode(formation)) {
      throw new ConvexError(
        "Esa formación no está disponible. Elige una de las formaciones habilitadas.",
      );
    }

    const lineup = autoLineup(squadPlayers, formation);
    const rules = await loadRules(ctx, tournament._id);
    const evaluation = evaluateSquadRules(
      rules,
      squadPlayers,
      president.budget,
      clubName,
    );
    const lineupEvaluation = evaluateLineup(rules, squadPlayers, lineup, evaluation);

    await ctx.db.patch(squad._id, {
      formation,
      lineup: lineup.slots,
      lineupUpdatedAt: Date.now(),
    });

    const user = await ctx.db.get(userId);
    await logAudit(ctx, {
      tournamentId: tournament._id,
      clubId: president.clubId,
      actorUserId: userId,
      actorName: user?.name ?? president.displayName,
      action: "Alineación automática aplicada",
      entity: "squad",
      entityId: squad._id,
      detail: `${FORMATIONS[formation].label} · XI generado por el motor de reglas${
        lineupEvaluation.valid ? " y validado" : " con alertas pendientes"
      }`,
    });

    return { formation, valid: lineupEvaluation.valid };
  },
});
