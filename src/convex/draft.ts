/**
 * 11Eleven — Draft backend.
 *
 * The draft is the moment the tournament promised: agreed operations are
 * validated one last time and executed, and then Presidents reinforce their
 * squads pick by pick, with the same rule engine guarding every acquisition.
 *
 * Availability is never cached: the pool is "catalogue players nobody owns in
 * this tournament", so a pick made by another President disappears from every
 * Control Center at once and a late attempt answers with who took the player
 * and when.
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type {
  DraftAdminView,
  DraftControlView,
  DraftPickView,
  DraftPoolPlayerView,
  DraftSummaryView,
  DraftTurnView,
} from "./appTypes";
import {
  getTournament,
  loadAdmin,
  loadPresident,
  loadRules,
  loadSquadPlayers,
  logAudit,
} from "./context";
import { DRAFT_STATUS_META, indexFor, sliceTotalSteps, type DraftStatus } from "./draftEngine";
import { runReservedExecutions } from "./market";
import {
  evaluateSigning,
  formatMoney,
  type RuleCheck,
  type SquadPlayerView,
  type TournamentRules,
} from "./rulesEngine";

/* ------------------------------------------------------------------ *\n * Context\n * ------------------------------------------------------------------ */

type DraftContext = {
  tournament: Doc<"tournaments">;
  rules: TournamentRules;
  president: Doc<"presidents">;
  club: Doc<"clubs">;
  squad: Doc<"squads">;
  squadPlayers: SquadPlayerView[];
};

async function loadDraftContext(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<DraftContext> {
  const tournament = await getTournament(ctx);
  if (!tournament) throw new ConvexError("El torneo no está disponible.");
  const president = await loadPresident(ctx, tournament._id, userId);
  if (!president) {
    throw new ConvexError(
      "Aún no presides ningún club. Selecciona tu club antes de entrar al draft.",
    );
  }
  const club = await ctx.db.get(president.clubId);
  if (!club) throw new ConvexError("No se encontró tu club en el torneo.");
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
  const rules = await loadRules(ctx, tournament._id);
  return { tournament, rules, president, club, squad, squadPlayers };
}

/** The live draft of a tournament: the most recently created one. */
async function loadDraft(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
): Promise<Doc<"drafts"> | null> {
  return await ctx.db
    .query("drafts")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .order("desc")
    .first();
}

/** Players already owned by somebody in this tournament. */
async function ownedPlayerIds(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
): Promise<Set<string>> {
  const rows = await ctx.db
    .query("squadPlayers")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  return new Set(rows.map((row) => row.playerId as string));
}

function currentPresidentId(
  draft: Doc<"drafts">,
): Id<"presidents"> | null {
  const { position } = indexFor({
    step: draft.currentIndex,
    orderSize: draft.order.length,
    snake: draft.snake,
  });
  return draft.order[position] ?? null;
}

function isDraftOver(draft: Doc<"drafts">): boolean {
  return draft.currentIndex >= sliceTotalSteps(draft.order.length, draft.totalRounds);
}

/* ------------------------------------------------------------------ *\n * Views\n * ------------------------------------------------------------------ */

async function buildTurnOrder(
  ctx: QueryCtx,
  params: {
    draft: Doc<"drafts">;
    tournamentId: Id<"tournaments">;
    /** Null when the viewer is an administrator without a presidency. */
    viewerPresidentId: Id<"presidents"> | null;
    /** Initial budget, used to derive how much each President has spent. */
    budgetLimit: number;
  },
): Promise<DraftTurnView[]> {
  const { draft, tournamentId, viewerPresidentId, budgetLimit } = params;
  const presidents = await ctx.db
    .query("presidents")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  const clubs = await ctx.db
    .query("clubs")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  const clubById = new Map(clubs.map((club) => [club._id as string, club]));
  const squadRows = await ctx.db
    .query("squadPlayers")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  const sizeByPresident = new Map<string, number>();
  for (const row of squadRows) {
    sizeByPresident.set(
      row.presidentId as string,
      (sizeByPresident.get(row.presidentId as string) ?? 0) + 1,
    );
  }
  const picks = await ctx.db
    .query("draftPicks")
    .withIndex("by_draft", (q) => q.eq("draftId", draft._id))
    .collect();
  const picksByPresident = new Map<string, number>();
  for (const pick of picks) {
    picksByPresident.set(
      pick.presidentId as string,
      (picksByPresident.get(pick.presidentId as string) ?? 0) + 1,
    );
  }

  const currentId = currentPresidentId(draft);
  const order: DraftTurnView[] = [];
  for (const presidentId of draft.order) {
    const president = presidents.find((row) => row._id === presidentId);
    if (!president) continue;
    const club = clubById.get(president.clubId as string);
    const user = await ctx.db.get(president.userId);
    order.push({
      presidentId,
      nickname: president.nickname || user?.name || "Presidente",
      clubName: club?.name ?? "Club sin asignar",
      clubShortName: club?.shortName ?? "—",
      clubColors: club
        ? [club.colorPrimary, club.colorSecondary]
        : ["#334155", "#0f172a"],
      isMe: presidentId === viewerPresidentId,
      isCurrent: presidentId === currentId,
      picks: picksByPresident.get(presidentId as string) ?? 0,
      spent: Math.max(0, budgetLimit - president.budget),
      squadSize: sizeByPresident.get(presidentId as string) ?? 0,
      budget: president.budget,
    });
  }
  return order;
}

export async function loadDraftSummary(
  ctx: QueryCtx,
  params: {
    tournamentId: Id<"tournaments">;
    rules: TournamentRules;
    presidentId: Id<"presidents">;
  },
): Promise<DraftSummaryView> {
  const { tournamentId, rules, presidentId } = params;
  const president = await ctx.db.get(presidentId);
  const draft = await loadDraft(ctx, tournamentId);
  const squadRows = await ctx.db
    .query("squadPlayers")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  const pool = await ctx.db.query("players").collect();
  const owned = new Set(squadRows.map((row) => row.playerId as string));

  const base: DraftSummaryView = {
    id: draft?._id ?? null,
    status: (draft?.status as DraftStatus) ?? null,
    statusLabel: draft ? DRAFT_STATUS_META[draft.status as DraftStatus].label : "Sin preparar",
    statusHint: draft
      ? DRAFT_STATUS_META[draft.status as DraftStatus].hint
      : "Administración todavía no ha preparado el draft. Mientras tanto puedes negociar en el mercado.",
    round: draft?.round ?? 0,
    totalRounds: draft?.totalRounds ?? 0,
    pickSeconds: draft?.pickSeconds ?? 0,
    currentDeadline: draft?.currentDeadline ?? null,
    currentPresidentId: draft ? currentPresidentId(draft) : null,
    currentNickname: null,
    currentClubName: null,
    currentClubColors: null,
    isMyTurn: false,
    myPosition: 0,
    orderSize: draft?.order.length ?? 0,
    poolSize: pool.filter((player) => !owned.has(player._id as string)).length,
    myPicks: 0,
    totalPicks: 0,
    myBudget: president?.budget ?? 0,
    squadSize: squadRows.filter((row) => row.presidentId === presidentId).length,
    squadSizeLimit: rules.squadSize,
    executedReserved: draft?.executedReserved ?? 0,
    invalidatedReserved: draft?.invalidatedReserved ?? 0,
  };

  if (!draft) return base;

  const currentId = currentPresidentId(draft);
  if (currentId) {
    const current = await ctx.db.get(currentId);
    if (current) {
      const user = await ctx.db.get(current.userId);
      const club = await ctx.db.get(current.clubId);
      base.currentNickname = current.nickname || user?.name || "Presidente";
      base.currentClubName = club?.name ?? null;
      base.currentClubColors = club
        ? [club.colorPrimary, club.colorSecondary]
        : null;
    }
  }
  base.isMyTurn = currentId === presidentId && draft.status === "en_curso";

  const picks = await ctx.db
    .query("draftPicks")
    .withIndex("by_draft", (q) => q.eq("draftId", draft._id))
    .collect();
  base.totalPicks = picks.length;
  base.myPicks = picks.filter((pick) => pick.presidentId === presidentId).length;
  const seat = draft.order.indexOf(presidentId);
  base.myPosition = seat >= 0 ? seat + 1 : 0;

  return base;
}

async function buildPicks(
  ctx: QueryCtx,
  params: { draftId: Id<"drafts">; tournamentId: Id<"tournaments"> },
): Promise<DraftPickView[]> {
  const { draftId, tournamentId } = params;
  const picks = await ctx.db
    .query("draftPicks")
    .withIndex("by_draft", (q) => q.eq("draftId", draftId))
    .collect();
  const clubs = await ctx.db
    .query("clubs")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  const clubById = new Map(clubs.map((club) => [club._id as string, club]));
  const presidents = await ctx.db
    .query("presidents")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();

  const views: DraftPickView[] = [];
  for (const pick of [...picks].sort((a, b) => b.pickNumber - a.pickNumber)) {
    const player = await ctx.db.get(pick.playerId);
    if (!player) continue;
    const club = clubById.get(pick.clubId as string);
    const president = presidents.find((row) => row._id === pick.presidentId);
    const user = president ? await ctx.db.get(president.userId) : null;
    views.push({
      id: pick._id,
      pickNumber: pick.pickNumber,
      round: pick.round,
      playerId: player._id,
      playerName: player.name,
      position: player.position,
      group: player.group,
      ovr: player.ovr,
      age: player.age,
      flag: player.flag,
      realClub: player.realClub,
      price: pick.price,
      presidentId: pick.presidentId,
      nickname: president?.nickname || user?.name || "Presidente",
      clubName: club?.name ?? "—",
      clubShortName: club?.shortName ?? "—",
      clubColors: club
        ? [club.colorPrimary, club.colorSecondary]
        : ["#334155", "#0f172a"],
      mode: pick.mode as "turno" | "reserva",
      pickedAt: pick.pickedAt,
    });
  }
  return views;
}

/* ------------------------------------------------------------------ *\n * Queries\n * ------------------------------------------------------------------ */

/**
 * The "modo árbitro" view: no president in mind, just the tournament's draft.
 */
export async function loadDraftAdmin(
  ctx: QueryCtx,
  params: { tournamentId: Id<"tournaments">; rules: TournamentRules },
): Promise<DraftAdminView> {
  const { tournamentId, rules } = params;
  const draft = await loadDraft(ctx, tournamentId);
  const squadRows = await ctx.db
    .query("squadPlayers")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  const catalogue = await ctx.db.query("players").collect();
  const owned = new Set(squadRows.map((row) => row.playerId as string));
  const offers = await ctx.db
    .query("offers")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();

  const base: DraftAdminView = {
    status: (draft?.status as DraftStatus) ?? null,
    statusLabel: draft
      ? DRAFT_STATUS_META[draft.status as DraftStatus].label
      : "Sin preparar",
    statusHint: draft
      ? DRAFT_STATUS_META[draft.status as DraftStatus].hint
      : "Prepara el draft para definir rondas, reloj y orden de turnos.",
    round: draft?.round ?? 0,
    totalRounds: draft?.totalRounds ?? 0,
    pickSeconds: draft?.pickSeconds ?? 0,
    snake: draft?.snake ?? false,
    currentDeadline: draft?.currentDeadline ?? null,
    currentPresidentId: draft ? currentPresidentId(draft) : null,
    currentNickname: null,
    currentClubName: null,
    orderSize: draft?.order.length ?? 0,
    totalSteps: draft ? sliceTotalSteps(draft.order.length, draft.totalRounds) : 0,
    totalPicks: 0,
    poolSize: catalogue.filter((player) => !owned.has(player._id as string)).length,
    reservedPending: offers.filter(
      (offer) => offer.status === "reservada" || offer.status === "aceptada",
    ).length,
    executedReserved: draft?.executedReserved ?? 0,
    invalidatedReserved: draft?.invalidatedReserved ?? 0,
    turnOrder: [],
    picks: [],
    unsignedPresidents: [],
  };
  if (!draft) return base;

  const [turnOrder, picks] = await Promise.all([
    buildTurnOrder(ctx, {
      draft,
      tournamentId,
      viewerPresidentId: null,
      budgetLimit: rules.budget,
    }),
    buildPicks(ctx, { draftId: draft._id, tournamentId }),
  ]);
  base.turnOrder = turnOrder;
  base.picks = picks;
  base.totalPicks = picks.length;

  const currentId = currentPresidentId(draft);
  if (currentId) {
    const president = await ctx.db.get(currentId);
    if (president) {
      const user = await ctx.db.get(president.userId);
      const club = await ctx.db.get(president.clubId);
      base.currentNickname = president.nickname || user?.name || "Presidente";
      base.currentClubName = club?.name ?? null;
    }
  }

  const presidents = await ctx.db
    .query("presidents")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  const inOrder = new Set(draft.order.map((id) => id as string));
  base.unsignedPresidents = presidents
    .filter((president) => !inOrder.has(president._id as string))
    .map((president) => president.nickname);

  return base;
}

/** The whole Draft Control Center, from one President's point of view. */
export async function loadDraftControl(
  ctx: QueryCtx,
  params: {
    tournamentId: Id<"tournaments">;
    rules: TournamentRules;
    presidentId: Id<"presidents">;
  },
): Promise<DraftControlView> {
  const { tournamentId, rules, presidentId } = params;
  const summary = await loadDraftSummary(ctx, { tournamentId, rules, presidentId });
  const draft = await loadDraft(ctx, tournamentId);
  const offers = await ctx.db
    .query("offers")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  const reservedPending = offers.filter(
    (offer) => offer.status === "reservada" || offer.status === "aceptada",
  ).length;

  if (!draft) {
    return { summary, turnOrder: [], picks: [], reservedPending };
  }
  const [turnOrder, picks] = await Promise.all([
    buildTurnOrder(ctx, {
      draft,
      tournamentId,
      viewerPresidentId: presidentId,
      budgetLimit: rules.budget,
    }),
    buildPicks(ctx, { draftId: draft._id, tournamentId }),
  ]);
  return { summary, turnOrder, picks, reservedPending };
}

export const control = query({
  args: {},
  handler: async (ctx): Promise<DraftControlView | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const { tournament, rules, president } = await loadDraftContext(ctx, userId);
    return await loadDraftControl(ctx, {
      tournamentId: tournament._id,
      rules,
      presidentId: president._id,
    });
  },
});

export const pool = query({
  args: {
    search: v.optional(v.string()),
    group: v.optional(
      v.union(
        v.literal("GK"),
        v.literal("DEF"),
        v.literal("MID"),
        v.literal("FWD"),
        v.literal("todos"),
      ),
    ),
    sort: v.optional(
      v.union(v.literal("ovr"), v.literal("value"), v.literal("age"), v.literal("name")),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<DraftPoolPlayerView[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const { tournament, rules, president, club, squadPlayers } =
      await loadDraftContext(ctx, userId);
    const draft = await loadDraft(ctx, tournament._id);
    const owned = await ownedPlayerIds(ctx, tournament._id);
    const catalogue = await ctx.db.query("players").collect();

    // Cheap pre-filter and sort first: with the full FC 27 catalogue (~19.7k
    // players) the rules engine must only run on the rows we are about to
    // return, otherwise the query blows Convex's 1-second user-code budget.
    const matches = catalogue.filter((player) => {
      if (owned.has(player._id as string)) return false;
      if (args.group && args.group !== "todos" && player.group !== args.group) {
        return false;
      }
      const term = args.search?.trim().toLowerCase();
      if (term) {
        const haystack = [
          player.name,
          player.nationality,
          player.position,
          player.realClub,
          player.realLeague,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    const sort = args.sort ?? "ovr";
    matches.sort((a, b) => {
      if (sort === "value") return b.value - a.value;
      if (sort === "age") return a.age - b.age;
      if (sort === "name") return a.name.localeCompare(b.name);
      return b.ovr - a.ovr;
    });

    const available = draft?.status === "en_curso";
    const rows: DraftPoolPlayerView[] = [];
    for (const player of matches.slice(0, args.limit ?? 60)) {
      const evaluation = evaluateSigning(
        rules,
        squadPlayers,
        {
          name: player.name,
          position: player.position,
          ovr: player.ovr,
          age: player.age,
          value: player.value,
          realClub: player.realClub,
        },
        president.budget,
        club.name,
      );
      rows.push({
        playerId: player._id,
        name: player.name,
        position: player.position,
        group: player.group,
        ovr: player.ovr,
        age: player.age,
        value: player.value,
        nationality: player.nationality,
        flag: player.flag,
        realClub: player.realClub,
        realLeague: player.realLeague,
        fcVersion: player.fcVersion,
        price: player.value,
        offerable: evaluation.passed && available,
        blockedReason: evaluation.passed
          ? available
            ? null
            : "El draft no está en curso: no se pueden cerrar adquisiciones ahora mismo."
          : evaluation.violations[0]?.detail ?? "La operación no cumple el reglamento.",
      });
    }

    return rows;
  },
});

/** Live preview of one pick: the same checks the mutation will re-run. */
export const check = query({
  args: { playerId: v.id("players") },
  handler: async (
    ctx,
    { playerId },
  ): Promise<{
    playerName: string;
    price: number;
    available: boolean;
    unavailableReason: string | null;
    isMyTurn: boolean;
    passed: boolean;
    checks: RuleCheck[];
    blockers: string[];
  } | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const { tournament, rules, president, club, squadPlayers } =
      await loadDraftContext(ctx, userId);
    const player = await ctx.db.get(playerId);
    if (!player) return null;

    const draft = await loadDraft(ctx, tournament._id);
    const owned = await ownedPlayerIds(ctx, tournament._id);
    const mine = owned.has(player._id as string);

    let unavailableReason: string | null = null;
    if (mine) {
      const row = await ctx.db
        .query("squadPlayers")
        .withIndex("by_player", (q) => q.eq("playerId", playerId))
        .collect();
      const owner = row.find((item) => item.tournamentId === tournament._id);
      if (owner && owner.clubId !== president.clubId) {
        const ownerClub = await ctx.db.get(owner.clubId);
        unavailableReason = `${player.name} ya fue adquirido por ${ownerClub?.name ?? "otro club"} en este torneo.`;
      } else {
        unavailableReason = `${player.name} ya forma parte de tu plantilla.`;
      }
    }

    const evaluation = evaluateSigning(
      rules,
      squadPlayers,
      {
        name: player.name,
        position: player.position,
        ovr: player.ovr,
        age: player.age,
        value: player.value,
        realClub: player.realClub,
      },
      president.budget,
      club.name,
    );

    const currentId = draft ? currentPresidentId(draft) : null;
    const isMyTurn = Boolean(draft) && draft?.status === "en_curso" && currentId === president._id;

    return {
      playerName: player.name,
      price: player.value,
      available: !unavailableReason,
      unavailableReason,
      isMyTurn,
      passed: evaluation.passed && !unavailableReason,
      checks: evaluation.checks,
      blockers: evaluation.violations.map((violation) => violation.detail),
    };
  },
});

/* ------------------------------------------------------------------ *\n * Admin: prepare / open / pause / resume / skip / close\n * ------------------------------------------------------------------ */

async function requireDraftAdmin(
  ctx: MutationCtx,
  userId: Id<"users">,
  permission: string,
): Promise<{ tournamentId: Id<"tournaments">; actorName: string }> {
  const tournament = await getTournament(ctx);
  if (!tournament) throw new ConvexError("El torneo no está disponible.");
  const admin = await loadAdmin(ctx, tournament._id, userId);
  if (!admin) {
    throw new ConvexError(
      "Solo Administración puede gestionar el draft del torneo.",
    );
  }
  if (admin.role !== "principal" && !admin.permissions.includes(permission)) {
    throw new ConvexError(
      "Tu rol de Co-Administrador no incluye el permiso de draft.",
    );
  }
  const user = await ctx.db.get(userId);
  return { tournamentId: tournament._id, actorName: user?.name ?? "Administración" };
}

export const prepare = mutation({
  args: {
    totalRounds: v.number(),
    pickSeconds: v.number(),
    snake: v.boolean(),
    orderMode: v.union(v.literal("inscripcion"), v.literal("sorteo")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Inicia sesión para preparar el draft.");
    const { tournamentId, actorName } = await requireDraftAdmin(ctx, userId, "draft");

    const presidents = await ctx.db
      .query("presidents")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
    if (presidents.length === 0) {
      throw new ConvexError(
        "Necesitas al menos un Presidente inscrito para preparar el draft.",
      );
    }
    if (args.totalRounds < 1 || args.totalRounds > 40) {
      throw new ConvexError("El draft debe tener entre 1 y 40 rondas.");
    }
    if (args.pickSeconds < 0 || args.pickSeconds > 24 * 60 * 60) {
      throw new ConvexError(
        "El tiempo por turno debe estar entre 0 segundos (sin reloj) y 24 horas.",
      );
    }

    const ordered = [...presidents].sort((a, b) => a.joinedAt - b.joinedAt);
    if (args.orderMode === "sorteo") {
      // Fisher-Yates: the lottery is drawn server-side and stored, so the order
      // is the same for everyone afterwards.
      for (let i = ordered.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
      }
    }
    const order = ordered.map((president) => president._id);

    const existing = await loadDraft(ctx, tournamentId);
    const now = Date.now();
    if (existing && existing.status === "en_curso") {
      throw new ConvexError(
        "El draft está en curso: pausa o ciérralo antes de cambiar la configuración.",
      );
    }

    let draftId: Id<"drafts">;
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "borrador",
        order,
        currentIndex: 0,
        round: 1,
        totalRounds: args.totalRounds,
        pickSeconds: args.pickSeconds,
        snake: args.snake,
        currentDeadline: undefined,
        updatedAt: now,
      });
      draftId = existing._id;
    } else {
      draftId = await ctx.db.insert("drafts", {
        tournamentId,
        status: "borrador",
        order,
        currentIndex: 0,
        round: 1,
        totalRounds: args.totalRounds,
        pickSeconds: args.pickSeconds,
        snake: args.snake,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(tournamentId, { status: "pre_draft" });
    await logAudit(ctx, {
      tournamentId,
      actorUserId: userId,
      actorName,
      action: "Draft preparado",
      entity: "draft",
      entityId: draftId,
      detail: `${presidents.length} Presidentes · ${args.totalRounds} rondas · ${
        args.pickSeconds > 0 ? `${Math.round(args.pickSeconds / 60)} min por turno` : "sin reloj"
      } · orden por ${args.orderMode}`,
    });

    return { draftId, orderSize: order.length, totalSteps: order.length * args.totalRounds };
  },
});

export const open = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Inicia sesión para abrir el draft.");
    const { tournamentId, actorName } = await requireDraftAdmin(ctx, userId, "draft");
    const draft = await loadDraft(ctx, tournamentId);
    if (!draft) {
      throw new ConvexError(
        "Todavía no hay un draft preparado: define rondas y tiempo por turno primero.",
      );
    }
    if (draft.status === "en_curso") {
      throw new ConvexError("El draft ya está en curso.");
    }
    if (draft.order.length === 0) {
      throw new ConvexError(
        "El draft no tiene Presidentes en el orden de turnos: vuelve a prepararlo.",
      );
    }

    // The draft moment: everything agreed in the market is validated and applied.
    const execution = await runReservedExecutions(ctx, {
      tournamentId,
      actorUserId: userId,
      actorName,
    });

    const now = Date.now();
    await ctx.db.patch(draft._id, {
      status: "en_curso",
      currentIndex: 0,
      round: 1,
      startedAt: now,
      closedAt: undefined,
      currentDeadline: draft.pickSeconds > 0 ? now + draft.pickSeconds * 1000 : undefined,
      executedReserved: execution.executed,
      invalidatedReserved: execution.invalidated,
      updatedAt: now,
    });
    await ctx.db.patch(tournamentId, {
      status: "draft_en_curso",
      marketOpen: false,
    });

    await logAudit(ctx, {
      tournamentId,
      actorUserId: userId,
      actorName,
      action: "Draft abierto",
      entity: "draft",
      entityId: draft._id,
      detail: `Mercado cerrado · ${execution.executed} operación(es) acordadas ejecutadas · ${execution.invalidated} invalidadas`,
    });

    await scheduleClock(ctx, draft._id);
    return {
      executed: execution.executed,
      invalidated: execution.invalidated,
      details: execution.details,
    };
  },
});

export const pause = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Inicia sesión para pausar el draft.");
    const { tournamentId, actorName } = await requireDraftAdmin(ctx, userId, "draft");
    const draft = await loadDraft(ctx, tournamentId);
    if (!draft || draft.status !== "en_curso") {
      throw new ConvexError("Solo se puede pausar un draft en curso.");
    }
    await ctx.db.patch(draft._id, {
      status: "pausado",
      currentDeadline: undefined,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      tournamentId,
      actorUserId: userId,
      actorName,
      action: "Draft pausado",
      entity: "draft",
      entityId: draft._id,
      detail: "El reloj se detiene y ninguna adquisición puede cerrarse hasta reanudar.",
    });
    return { ok: true };
  },
});

export const resume = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Inicia sesión para reanudar el draft.");
    const { tournamentId, actorName } = await requireDraftAdmin(ctx, userId, "draft");
    const draft = await loadDraft(ctx, tournamentId);
    if (!draft || draft.status !== "pausado") {
      throw new ConvexError("Solo se puede reanudar un draft en pausa.");
    }
    const now = Date.now();
    await ctx.db.patch(draft._id, {
      status: "en_curso",
      currentDeadline: draft.pickSeconds > 0 ? now + draft.pickSeconds * 1000 : undefined,
      updatedAt: now,
    });
    await logAudit(ctx, {
      tournamentId,
      actorUserId: userId,
      actorName,
      action: "Draft reanudado",
      entity: "draft",
      entityId: draft._id,
      detail: "Turnos activos de nuevo.",
    });
    await scheduleClock(ctx, draft._id);
    return { ok: true };
  },
});

/** Admin arbitration: pass the turn when a President is not responding. */
export const skipTurn = mutation({
  args: { reason: v.optional(v.string()) },
  handler: async (ctx, { reason }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Inicia sesión para saltar un turno.");
    const { tournamentId, actorName } = await requireDraftAdmin(ctx, userId, "draft");
    const draft = await loadDraft(ctx, tournamentId);
    if (!draft || draft.status !== "en_curso") {
      throw new ConvexError("Solo se puede saltar un turno en un draft en curso.");
    }
    const skipped = currentPresidentId(draft);
    await advance(ctx, {
      draft,
      reason: reason?.trim() || "Turno saltado por Administración",
      action: "Turno saltado",
      actorUserId: userId,
      actorName,
    });
    return { skippedPresidentId: skipped };
  },
});

export const close = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Inicia sesión para cerrar el draft.");
    const { tournamentId, actorName } = await requireDraftAdmin(ctx, userId, "draft");
    const draft = await loadDraft(ctx, tournamentId);
    if (!draft) throw new ConvexError("No hay ningún draft que cerrar.");
    if (draft.status === "cerrado") {
      throw new ConvexError("El draft ya está cerrado.");
    }
    const picks = await ctx.db
      .query("draftPicks")
      .withIndex("by_draft", (q) => q.eq("draftId", draft._id))
      .collect();

    await ctx.db.patch(draft._id, {
      status: "cerrado",
      currentDeadline: undefined,
      closedAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.patch(tournamentId, {
      status: "plantillas_bloqueadas",
      marketOpen: false,
    });
    await logAudit(ctx, {
      tournamentId,
      actorUserId: userId,
      actorName,
      action: "Draft cerrado",
      entity: "draft",
      entityId: draft._id,
      detail: `${picks.length} adquisición(es) registradas · plantillas bloqueadas`,
    });
    return { picks: picks.length };
  },
});

/* ------------------------------------------------------------------ *\n * Pick + clock\n * ------------------------------------------------------------------ */

async function scheduleClock(ctx: MutationCtx, draftId: Id<"drafts">) {
  const draft = await ctx.db.get(draftId);
  if (!draft || draft.status !== "en_curso" || draft.pickSeconds <= 0) return;
  if (isDraftOver(draft)) return;
  const delay = Math.max(1000, draft.pickSeconds * 1000);
  await ctx.scheduler.runAfter(delay, internal.draft.clockExpired, {
    draftId,
    step: draft.currentIndex,
  });
}

async function advance(
  ctx: MutationCtx,
  params: {
    draft: Doc<"drafts">;
    reason: string;
    action: string;
    actorUserId?: Id<"users">;
    actorName: string;
  },
) {
  const { draft, reason, action, actorUserId, actorName } = params;
  const nextStep = draft.currentIndex + 1;
  const total = sliceTotalSteps(draft.order.length, draft.totalRounds);
  const now = Date.now();
  const { round } = indexFor({
    step: nextStep,
    orderSize: draft.order.length,
    snake: draft.snake,
  });

  if (nextStep >= total) {
    await ctx.db.patch(draft._id, {
      status: "cerrado",
      currentIndex: nextStep,
      round: draft.totalRounds,
      currentDeadline: undefined,
      closedAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(draft.tournamentId, {
      status: "plantillas_bloqueadas",
      marketOpen: false,
    });
    await logAudit(ctx, {
      tournamentId: draft.tournamentId,
      actorUserId,
      actorName,
      action: "Draft finalizado automáticamente",
      entity: "draft",
      entityId: draft._id,
      detail: `${reason} · se completaron las ${draft.totalRounds} rondas previstas`,
    });
    return;
  }

  await ctx.db.patch(draft._id, {
    currentIndex: nextStep,
    round,
    currentDeadline: draft.pickSeconds > 0 ? now + draft.pickSeconds * 1000 : undefined,
    updatedAt: now,
  });
  await logAudit(ctx, {
    tournamentId: draft.tournamentId,
    actorUserId,
    actorName,
    action,
    entity: "draft",
    entityId: draft._id,
    detail: `${reason} · ronda ${round}`,
  });
  await scheduleClock(ctx, draft._id);
}

/** The per-turn clock: if the President does not pick, the turn moves on. */
export const clockExpired = internalMutation({
  args: { draftId: v.id("drafts"), step: v.number() },
  handler: async (ctx, { draftId, step }) => {
    const draft = await ctx.db.get(draftId);
    if (!draft || draft.status !== "en_curso" || draft.currentIndex !== step) return;
    const presidentId = currentPresidentId(draft);
    const president = presidentId ? await ctx.db.get(presidentId) : null;
    const user = president ? await ctx.db.get(president.userId) : null;
    await advance(ctx, {
      draft,
      reason: `Se agotó el tiempo de ${president?.nickname || user?.name || "el Presidente"}`,
      action: "Turno expirado",
      actorName: "Reloj del draft",
    });
  },
});

export const pick = mutation({
  args: { playerId: v.id("players") },
  handler: async (ctx, { playerId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Inicia sesión para fichar en el draft.");
    const { tournament, rules, president, club, squad, squadPlayers } =
      await loadDraftContext(ctx, userId);
    const draft = await loadDraft(ctx, tournament._id);
    if (!draft) {
      throw new ConvexError(
        "Administración todavía no ha abierto el draft. Puedes negociar en el mercado mientras tanto.",
      );
    }
    const status = draft.status as DraftStatus;
    if (status !== "en_curso") {
      throw new ConvexError(
        `${DRAFT_STATUS_META[status].label}: ${DRAFT_STATUS_META[status].hint}`,
      );
    }

    const currentId = currentPresidentId(draft);
    if (currentId !== president._id) {
      const current = currentId ? await ctx.db.get(currentId) : null;
      const currentUser = current ? await ctx.db.get(current.userId) : null;
      const currentClub = current ? await ctx.db.get(current.clubId) : null;
      throw new ConvexError(
        `Todavía no es tu turno: ahora mismo elige ${
          current?.nickname || currentUser?.name || "otro Presidente"
        } (${currentClub?.name ?? "sin club"}). Te avisaremos cuando llegue tu turno.`,
      );
    }

    const player = await ctx.db.get(playerId);
    if (!player) throw new ConvexError("Este jugador ya no existe en el torneo.");

    // Real-time availability: explain who took the player and when.
    const ownership = await ctx.db
      .query("squadPlayers")
      .withIndex("by_player", (q) => q.eq("playerId", playerId))
      .collect();
    const takenInTournament = ownership.find(
      (row) => row.tournamentId === tournament._id,
    );
    if (takenInTournament) {
      if (takenInTournament.clubId === club._id) {
        throw new ConvexError(`${player.name} ya forma parte de tu plantilla.`);
      }
      const ownerClub = await ctx.db.get(takenInTournament.clubId);
      const owner = await ctx.db.get(takenInTournament.presidentId);
      const seconds = Math.max(
        0,
        Math.round((Date.now() - takenInTournament.joinedAt) / 1000),
      );
      throw new ConvexError(
        `${player.name} ya no está disponible: lo adquirió ${
          ownerClub?.name ?? "otro club"
        } (${owner?.nickname ?? "Presidente"}) hace ${
          seconds < 60 ? `${seconds} segundos` : `${Math.round(seconds / 60)} minutos`
        }.`,
      );
    }

    const evaluation = evaluateSigning(
      rules,
      squadPlayers,
      {
        name: player.name,
        position: player.position,
        ovr: player.ovr,
        age: player.age,
        value: player.value,
        realClub: player.realClub,
      },
      president.budget,
      club.name,
    );
    if (!evaluation.passed) {
      throw new ConvexError(
        evaluation.violations[0]?.detail ?? "La operación no cumple el reglamento.",
      );
    }

    const now = Date.now();
    await ctx.db.insert("squadPlayers", {
      tournamentId: tournament._id,
      clubId: club._id,
      squadId: squad._id,
      playerId,
      presidentId: president._id,
      availability: "neutro",
      ovrAtJoin: player.ovr,
      valueAtJoin: player.value,
      joinedAt: now,
    });
    await ctx.db.patch(president._id, { budget: president.budget - player.value });

    const pickNumber = draft.currentIndex + 1;
    await ctx.db.insert("draftPicks", {
      tournamentId: tournament._id,
      draftId: draft._id,
      presidentId: president._id,
      clubId: club._id,
      playerId,
      price: player.value,
      round: draft.round,
      pickNumber,
      mode: "turno",
      pickedAt: now,
    });

    await logAudit(ctx, {
      tournamentId: tournament._id,
      clubId: club._id,
      actorUserId: userId,
      actorName: president.displayName,
      action: "Fichaje en el draft",
      entity: "player",
      entityId: playerId,
      detail: `${president.nickname} ficha a ${player.name} (${player.position} · OVR ${player.ovr}) por ${formatMoney(player.value)} en la ronda ${draft.round}`,
    });

    await advance(ctx, {
      draft,
      reason: `${president.nickname} fichó a ${player.name} por ${formatMoney(player.value)}`,
      action: "Turno completado",
      actorUserId: userId,
      actorName: president.displayName,
    });

    // Report the next turn by reading the draft AFTER it advanced, so the
    // President learns whose turn it is now (or that the draft just closed).
    const after = await ctx.db.get(draft._id);
    const nextPresidentId =
      after && after.status === "en_curso" ? currentPresidentId(after) : null;
    const nextPresident = nextPresidentId ? await ctx.db.get(nextPresidentId) : null;
    const nextUser = nextPresident ? await ctx.db.get(nextPresident.userId) : null;

    return {
      playerName: player.name,
      price: player.value,
      remainingBudget: president.budget - player.value,
      squadSize: squadPlayers.length + 1,
      draftClosed: after?.status === "cerrado",
      nextNickname: nextPresident?.nickname || nextUser?.name || null,
    };
  },
});

