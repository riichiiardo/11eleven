import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import type {
  MarketOverviewView,
  MarketPlayerView,
  MarketSummaryView,
  OfferPlayerLite,
  OfferView,
} from "./appTypes";
import {
  buildOffers,
  getTournament,
  loadAdmin,
  loadPresident,
  loadRules,
  loadSquadPlayers,
  loadTournamentOffers,
  logAudit,
} from "./context";
import {
  FREE_AGENT_CLUB,
  formatMoney,
  type PlayerAvailability,
  type RuleCheck,
  type SquadPlayerView,
  type TournamentRules,
} from "./rulesEngine";
import {
  COMMITTED_STATUSES,
  OFFER_STATUS_META,
  OPEN_STATUSES,
  describeIntent,
  evaluateExecution,
  evaluateOffer,
  offerGuidance,
  type MarketIntent,
  type OfferPlayer,
  type OfferStatus,
  type OfferType,
  type OwnershipState,
} from "./marketEngine";

/* ------------------------------------------------------------------ *
 * Context helpers
 * ------------------------------------------------------------------ */

type MarketContext = {
  tournament: Doc<"tournaments">;
  rules: TournamentRules;
  president: Doc<"presidents">;
  club: Doc<"clubs">;
  squad: Doc<"squads">;
  squadPlayers: SquadPlayerView[];
};

async function loadMarketContext(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<MarketContext> {
  const tournament = await getTournament(ctx);
  if (!tournament) throw new ConvexError("El torneo no está disponible.");
  const president = await loadPresident(ctx, tournament._id, userId);
  if (!president) {
    throw new ConvexError(
      "Aún no presides ningún club. Selecciona tu club antes de operar en el mercado.",
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

function tournamentAllowsOperations(status: string): boolean {
  return status !== "suspendido" && status !== "cancelado";
}

async function ownershipRows(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
): Promise<Map<string, Doc<"squadPlayers">>> {
  const rows = await ctx.db
    .query("squadPlayers")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  return new Map(rows.map((row) => [row.playerId as string, row]));
}

function toOfferPlayer(player: Doc<"players">): OfferPlayer {
  return {
    playerId: player._id,
    name: player.name,
    position: player.position,
    group: player.group,
    ovr: player.ovr,
    age: player.age,
    value: player.value,
    realClub: player.realClub,
  };
}

/** Offers that still hold a commitment over a player. */
async function commitmentsFor(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
  playerIds: Id<"players">[],
  ignoreOfferId?: Id<"offers">,
): Promise<{ offerId: Id<"offers">; status: OfferStatus; playerName: string } | null> {
  const ids = new Set(playerIds.map((id) => id as string));
  const offers = await loadTournamentOffers(ctx, tournamentId);

  for (const offer of offers) {
    if (ignoreOfferId && offer._id === ignoreOfferId) continue;
    if (!COMMITTED_STATUSES.includes(offer.status as OfferStatus)) continue;
    const involved = [...offer.requestedPlayerIds, ...offer.offeredPlayerIds].filter((id) =>
      ids.has(id as string),
    );
    if (involved.length === 0) continue;
    const player = await ctx.db.get(involved[0]);
    return {
      offerId: offer._id,
      status: offer.status as OfferStatus,
      playerName: player?.name ?? "El jugador",
    };
  }
  return null;
}

async function lockedCash(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
  presidentId: Id<"presidents">,
  ignoreOfferId?: Id<"offers">,
): Promise<number> {
  const offers = await loadTournamentOffers(ctx, tournamentId);
  return offers
    .filter(
      (offer) =>
        offer.bidderPresidentId === presidentId &&
        offer._id !== ignoreOfferId &&
        ["enviada", "negociacion", "aceptada", "reservada"].includes(offer.status),
    )
    .reduce((sum, offer) => sum + offer.cash, 0);
}

async function shortId(offerId: Id<"offers">): Promise<string> {
  return `#${offerId.slice(-4).toUpperCase()}`;
}

/* ------------------------------------------------------------------ *
 * Browse
 * ------------------------------------------------------------------ */

const groupArg = v.union(
  v.literal("GK"),
  v.literal("DEF"),
  v.literal("MID"),
  v.literal("FWD"),
  v.literal("todos"),
);

export const browse = query({
  args: {
    scope: v.union(v.literal("todos"), v.literal("libre"), v.literal("clubes")),
    search: v.optional(v.string()),
    group: v.optional(groupArg),
    minOvr: v.optional(v.number()),
    sort: v.optional(
      v.union(
        v.literal("ovr"),
        v.literal("value"),
        v.literal("age"),
        v.literal("name"),
      ),
    ),
    onlyAffordable: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<MarketPlayerView[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const { tournament, president } = await loadMarketContext(ctx, userId);

    const ownership = await ownershipRows(ctx, tournament._id);
    const catalogue = await ctx.db.query("players").collect();
    const clubs = await ctx.db
      .query("clubs")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
      .collect();
    const clubById = new Map(clubs.map((club) => [club._id as string, club]));
    const presidents = await ctx.db
      .query("presidents")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournament._id))
      .collect();
    const presidentByClub = new Map(
      presidents.map((row) => [row.clubId as string, row]),
    );
    const nicknameCache = new Map<string, string>();
    const nicknameFor = async (presidentId: Id<"presidents">) => {
      if (nicknameCache.has(presidentId)) return nicknameCache.get(presidentId)!;
      const row = presidents.find((item) => item._id === presidentId);
      if (!row) return "—";
      const user = await ctx.db.get(row.userId);
      const nickname = row.nickname || user?.name || "—";
      nicknameCache.set(presidentId, nickname);
      return nickname;
    };

    const committed = new Map<string, Id<"offers">>();
    const openOffers = await loadTournamentOffers(ctx, tournament._id);
    for (const offer of openOffers) {
      if (!COMMITTED_STATUSES.includes(offer.status as OfferStatus)) continue;
      for (const playerId of [...offer.requestedPlayerIds, ...offer.offeredPlayerIds]) {
        committed.set(playerId as string, offer._id);
      }
    }

    const budget = president.budget;
    const locked = await lockedCash(ctx, tournament._id, president._id);
    const spendable = Math.max(0, budget - locked);

    const rows: MarketPlayerView[] = [];
    for (const player of catalogue) {
      const ownershipRow = ownership.get(player._id as string) ?? null;
      const ownerClub = ownershipRow ? clubById.get(ownershipRow.clubId as string) ?? null : null;
      const ownerPresidentId = ownershipRow
        ? presidentByClub.get(ownershipRow.clubId as string)?._id ?? null
        : null;
      const ownerIsMe = Boolean(ownershipRow && ownershipRow.clubId === president.clubId);
      const freeAgent = !ownershipRow && player.realClub === FREE_AGENT_CLUB;

      const kind: MarketPlayerView["kind"] = freeAgent ? "libre" : "club";
      if (args.scope === "libre" && !freeAgent) continue;
      if (args.scope === "clubes" && freeAgent) continue;
      if (args.group && args.group !== "todos" && player.group !== args.group) continue;
      if (typeof args.minOvr === "number" && player.ovr < args.minOvr) continue;

      const term = args.search?.trim().toLowerCase();
      if (term) {
        const haystack = [
          player.name,
          player.nationality,
          player.position,
          player.realClub,
          player.realLeague,
          ownerClub?.name ?? "",
          ownerClub?.league ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) continue;
      }

      const availability: MarketPlayerView["availability"] = freeAgent
        ? "libre"
        : (ownershipRow?.availability as PlayerAvailability) ?? "neutro";

      const committedOfferId = committed.get(player._id as string) ?? null;
      const minimumCash = freeAgent ? player.value : 0;
      const withinBudget = spendable >= minimumCash;

      let blockedReason: string | null = null;
      if (ownerIsMe) {
        blockedReason =
          "Es tu propio jugador: ya forma parte de tu plantilla y puedes gestionarlo desde Mi Club.";
      } else if (!freeAgent && !ownershipRow) {
        blockedReason =
          "El club de este jugador aún no tiene Presidente en el torneo: su plantilla entra al mercado cuando se asigne la presidencia.";
      } else if (availability === "intransferible") {
        blockedReason = `${ownerClub?.name ?? "El club"} marcó a ${player.name} como intransferible: el Presidente bloqueó cualquier oferta por él.`;
      } else if (committedOfferId) {
        blockedReason = `${player.name} ya está comprometido en otra operación abierta del torneo.`;
      } else if (!withinBudget) {
        blockedReason = `Tu presupuesto disponible es ${formatMoney(spendable)} y el coste de firma de ${player.name} es ${formatMoney(minimumCash)}.`;
      }

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
        kind,
        ownerClubId: ownerClub?._id ?? null,
        ownerClubName: ownerClub?.name ?? null,
        ownerShortName: ownerClub?.shortName ?? null,
        ownerColors: ownerClub
          ? [ownerClub.colorPrimary, ownerClub.colorSecondary]
          : null,
        ownerNickname: ownerPresidentId ? await nicknameFor(ownerPresidentId) : null,
        ownerPresidentId,
        ownerIsMe,
        availability,
        offerable: blockedReason === null,
        blockedReason,
        committedOfferId,
        withinBudget,
        minimumCash,
      });
    }

    const sort = args.sort ?? "ovr";
    rows.sort((a, b) => {
      if (sort === "value") return b.value - a.value;
      if (sort === "age") return a.age - b.age;
      if (sort === "name") return a.name.localeCompare(b.name);
      return b.ovr - a.ovr;
    });

    if (args.onlyAffordable) {
      return rows.filter((row) => row.withinBudget && row.offerable);
    }

    return rows.slice(0, args.limit ?? 60);
  },
});

/* ------------------------------------------------------------------ *
 * Overview
 * ------------------------------------------------------------------ */

export const overview = query({
  args: {},
  handler: async (ctx): Promise<MarketOverviewView | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const { tournament, president, rules } = await loadMarketContext(ctx, userId);

    const offers = await loadTournamentOffers(ctx, tournament._id);
    const views = await buildOffers(ctx, {
      tournamentId: tournament._id,
      offers,
      viewerPresidentId: president._id,
      tournamentAllowsOperations: tournamentAllowsOperations(tournament.status),
      marketOpen: tournament.marketOpen,
    });

    const mine = views.filter((offer) => offer.side !== "sistema");
    const received = mine.filter(
      (offer) =>
        offer.side === "recibida" &&
        (offer.status === "enviada" || offer.status === "negociacion"),
    );
    const sent = mine.filter(
      (offer) =>
        offer.side === "enviada" &&
        (offer.status === "enviada" || offer.status === "negociacion"),
    );
    const reserved = mine.filter(
      (offer) => offer.status === "reservada" || offer.status === "aceptada",
    );
    const history = mine.filter((offer) =>
      ["ejecutada", "rechazada", "cancelada", "expirada", "invalidada"].includes(
        offer.status,
      ),
    );

    const freeAgents = await ctx.db
      .query("players")
      .withIndex("by_real_club", (q) => q.eq("realClub", FREE_AGENT_CLUB))
      .collect();
    const ownership = await ownershipRows(ctx, tournament._id);

    const summary: MarketSummaryView = {
      open: tournament.marketOpen,
      freeAgents: freeAgents.filter((player) => !ownership.has(player._id as string)).length,
      received: received.length,
      sent: sent.length,
      reserved: reserved.length,
      executed: history.filter((offer) => offer.status === "ejecutada").length,
      committedCash: await lockedCash(ctx, tournament._id, president._id),
    };

    return {
      summary,
      budget: {
        initial: rules.budget,
        committed: Math.max(0, rules.budget - president.budget),
        available: president.budget,
      },
      received,
      sent,
      reserved,
      history,
    };
  },
});

/* ------------------------------------------------------------------ *
 * Create offer
 * ------------------------------------------------------------------ */

const idList = v.array(v.id("players"));

export const createOffer = mutation({
  args: {
    requestedPlayerIds: idList,
    offeredPlayerIds: idList,
    cash: v.number(),
    message: v.optional(v.string()),
    parentOfferId: v.optional(v.id("offers")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Inicia sesión para operar en el mercado.");
    const { tournament, rules, president, club, squadPlayers } =
      await loadMarketContext(ctx, userId);

    if (!tournamentAllowsOperations(tournament.status)) {
      throw new ConvexError(
        "El torneo está suspendido o cancelado: no se admiten nuevas operaciones.",
      );
    }
    if (args.requestedPlayerIds.length === 0) {
      throw new ConvexError(
        "Selecciona al menos un jugador para la operación.",
      );
    }
    if (args.requestedPlayerIds.length > 1 || args.offeredPlayerIds.length > 1) {
      throw new ConvexError(
        "En esta fase cada operación incluye un jugador por lado. Divide el intercambio en varias operaciones.",
      );
    }
    if (args.cash < 0) {
      throw new ConvexError("La oferta económica no puede ser negativa.");
    }

    const requestedPlayers: Doc<"players">[] = [];
    for (const playerId of args.requestedPlayerIds) {
      const player = await ctx.db.get(playerId);
      if (!player) throw new ConvexError("Uno de los jugadores ya no existe en el torneo.");
      if (squadPlayers.some((mine) => mine.playerId === playerId)) {
        throw new ConvexError(`${player.name} ya está en tu plantilla.`);
      }
      requestedPlayers.push(player);
    }

    const ownership = await ownershipRows(ctx, tournament._id);
    const sellerRows = requestedPlayers.map(
      (player) => ownership.get(player._id as string) ?? null,
    );

    const ownedByOthers = sellerRows.filter((row): row is Doc<"squadPlayers"> => Boolean(row));
    const sellerClubIds = [...new Set(ownedByOthers.map((row) => row.clubId as string))];
    if (sellerClubIds.length > 1) {
      throw new ConvexError(
        "Los jugadores solicitados pertenecen a clubes distintos: cada operación se negocia con un solo Presidente.",
      );
    }
    const sellerClubId = sellerClubIds[0] ? (sellerClubIds[0] as Id<"clubs">) : null;
    const sellerClub = sellerClubId ? await ctx.db.get(sellerClubId) : null;
    const sellerPresident = sellerClubId
      ? (await ctx.db
          .query("presidents")
          .withIndex("by_club", (q) => q.eq("clubId", sellerClubId))
          .first()) ?? null
      : null;
    const sellerSquad = sellerPresident
      ? await ctx.db
          .query("squads")
          .withIndex("by_club", (q) => q.eq("clubId", sellerPresident.clubId))
          .first()
      : null;
    const sellerPlayers = sellerSquad ? await loadSquadPlayers(ctx, sellerSquad._id) : null;

    const freeAgentDeal = sellerRows.every((row) => row === null);
    if (!freeAgentDeal && !sellerPresident) {
      throw new ConvexError(
        `El club ${sellerClub?.name ?? "de estos jugadores"} no tiene Presidente: su plantilla solo entra al mercado cuando se asigne la presidencia.`,
      );
    }

    const offeredPlayers: Doc<"players">[] = [];
    for (const playerId of args.offeredPlayerIds) {
      const player = await ctx.db.get(playerId);
      if (!player) throw new ConvexError("Uno de los jugadores ofrecidos ya no existe.");
      const mine = squadPlayers.find((row) => row.playerId === playerId);
      if (!mine) {
        throw new ConvexError(
          `${player.name} no pertenece a tu plantilla y no puede formar parte de la operación.`,
        );
      }
      offeredPlayers.push(player);
    }

    if (freeAgentDeal && offeredPlayers.length > 0) {
      throw new ConvexError(
        "Un agente libre se incorpora con presupuesto: no se puede intercambiar por jugadores.",
      );
    }

    const minimumCash = freeAgentDeal
      ? requestedPlayers.reduce((sum, player) => sum + player.value, 0)
      : 0;
    if (freeAgentDeal && args.cash < minimumCash) {
      throw new ConvexError(
        `El coste de firma de ${requestedPlayers.map((p) => p.name).join(", ")} es ${formatMoney(minimumCash)}. Ajusta la oferta económica para continuar.`,
      );
    }

    const commitment = await commitmentsFor(
      ctx,
      tournament._id,
      [...args.requestedPlayerIds, ...args.offeredPlayerIds],
    );
    if (commitment) {
      throw new ConvexError(
        `${commitment.playerName} ya está comprometido en la operación ${await shortId(commitment.offerId)} (${OFFER_STATUS_META[commitment.status].label}). Debes esperar a que se resuelva.`,
      );
    }

    const locked = await lockedCash(ctx, tournament._id, president._id);
    if (args.cash > Math.max(0, president.budget - locked)) {
      throw new ConvexError(
        `No puedes comprometer ${formatMoney(args.cash)}: tu presupuesto disponible es ${formatMoney(president.budget)} y ya tienes ${formatMoney(locked)} comprometidos en otras operaciones.`,
      );
    }

    const intent: MarketIntent = {
      type: offeredPlayers.length > 0 ? "trade" : "cash",
      cash: args.cash,
      requested: requestedPlayers.map(toOfferPlayer),
      offered: offeredPlayers.map(toOfferPlayer),
    };

    const evaluation = evaluateOffer({
      rules,
      intent,
      bidderSquad: squadPlayers,
      bidderBudget: Math.max(0, president.budget - locked),
      bidderClubName: club.name,
      sellerSquad: sellerPlayers,
      sellerBudget: sellerPresident?.budget ?? 0,
      sellerClubName: sellerClub?.name,
      sellerLabel: `Plantilla de ${sellerClub?.name ?? "agente libre"}`,
    });

    if (!evaluation.passed) {
      throw new ConvexError(evaluation.blockers[0].detail);
    }

    const now = Date.now();
    const offerId = await ctx.db.insert("offers", {
      tournamentId: tournament._id,
      type: intent.type,
      bidderPresidentId: president._id,
      bidderClubId: club._id,
      sellerPresidentId: sellerPresident?._id,
      sellerClubId: sellerClubId ?? undefined,
      requestedPlayerIds: args.requestedPlayerIds,
      offeredPlayerIds: args.offeredPlayerIds,
      cash: args.cash,
      message: args.message,
      status: freeAgentDeal ? "aceptada" : "enviada",
      parentOfferId: args.parentOfferId,
      lastValidation: `${evaluation.checks.filter((c) => c.passed).length}/${evaluation.checks.length} comprobaciones superadas`,
      createdAt: now,
      updatedAt: now,
      agreedAt: freeAgentDeal ? now : undefined,
    });

    await logAudit(ctx, {
      tournamentId: tournament._id,
      clubId: club._id,
      actorUserId: userId,
      actorName: president.displayName,
      action: freeAgentDeal ? "Oferta de firma registrada" : "Oferta enviada",
      entity: "offer",
      entityId: offerId,
      detail: `${president.nickname} ${describeIntent(intent)}${
        sellerClub ? ` · destinatario ${sellerClub.name}` : " · agente libre"
      }`,
    });

    // A free-agent signing has no counterpart: it either executes now or waits
    // for the market window, exactly like any other agreed operation.
    if (freeAgentDeal) {
      const result = await tryExecute(ctx, offerId, president, userId);
      if (result.executed) {
        return { offerId, status: "ejecutada" as OfferStatus, message: result.message };
      }
      return { offerId, status: "reservada" as OfferStatus, message: result.message };
    }

    return {
      offerId,
      status: "enviada" as OfferStatus,
      message: `Oferta enviada a ${sellerClub?.name ?? "el club"}. El Presidente debe responder.`,
    };
  },
});

/* ------------------------------------------------------------------ *
 * Respond
 * ------------------------------------------------------------------ */

export const respondOffer = mutation({
  args: {
    offerId: v.id("offers"),
    action: v.union(v.literal("aceptar"), v.literal("rechazar")),
    message: v.optional(v.string()),
  },
  handler: async (ctx, { offerId, action, message }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Inicia sesión para responder una oferta.");
    const { tournament, rules, president, club, squadPlayers } =
      await loadMarketContext(ctx, userId);

    const offer = await ctx.db.get(offerId);
    if (!offer || offer.tournamentId !== tournament._id) {
      throw new ConvexError("La operación no pertenece a este torneo.");
    }
    if (offer.sellerPresidentId !== president._id) {
      throw new ConvexError(
        "Solo el Presidente destinatario puede responder esta operación. Si eres el autor, puedes cancelarla.",
      );
    }
    if (!OPEN_STATUSES.includes(offer.status as OfferStatus)) {
      throw new ConvexError(
        `Esta operación está en estado ${OFFER_STATUS_META[offer.status as OfferStatus].label} y ya no admite respuesta.`,
      );
    }
    if (!tournamentAllowsOperations(tournament.status)) {
      throw new ConvexError(
        "El torneo está suspendido o cancelado: no se pueden resolver operaciones.",
      );
    }

    const now = Date.now();

    if (action === "rechazar") {
      await ctx.db.patch(offerId, {
        status: "rechazada",
        updatedAt: now,
        message: message ?? offer.message,
      });
      await logAudit(ctx, {
        tournamentId: tournament._id,
        clubId: club._id,
        actorUserId: userId,
        actorName: president.displayName,
        action: "Oferta rechazada",
        entity: "offer",
        entityId: offerId,
        detail: `${president.nickname} rechazó la operación ${await shortId(offerId)}`,
      });
      return { status: "rechazada" as OfferStatus };
    }

    // ---- Accept: re-validate the whole operation against the current state ----
    const requestedIds = offer.requestedPlayerIds;
    const offeredIds = offer.offeredPlayerIds;
    const commitment = await commitmentsFor(
      ctx,
      tournament._id,
      [...requestedIds, ...offeredIds],
      offerId,
    );
    if (commitment) {
      throw new ConvexError(
        `${commitment.playerName} ya está comprometido en la operación ${await shortId(commitment.offerId)}. No se puede aceptar una segunda operación sobre el mismo jugador.`,
      );
    }

    const ownership = await ownershipRows(ctx, tournament._id);
    for (const playerId of requestedIds) {
      const row = ownership.get(playerId as string);
      if (!row || row.clubId !== president.clubId) {
        const player = await ctx.db.get(playerId);
        throw new ConvexError(
          `${player?.name ?? "El jugador"} ya no pertenece a tu plantilla: la operación debe renegociarse.`,
        );
      }
    }
    for (const playerId of offeredIds) {
      const row = ownership.get(playerId as string);
      if (!row || row.clubId !== offer.bidderClubId) {
        const player = await ctx.db.get(playerId);
        throw new ConvexError(
          `${player?.name ?? "El jugador ofrecido"} ya no está en la plantilla del club que oferta: la operación debe renegociarse.`,
        );
      }
    }

    const bidderPresident = await ctx.db.get(offer.bidderPresidentId);
    const bidderClub = await ctx.db.get(offer.bidderClubId);
    const bidderSquad = await ctx.db
      .query("squads")
      .withIndex("by_club", (q) => q.eq("clubId", offer.bidderClubId))
      .first();
    const bidderPlayers = bidderSquad
      ? await loadSquadPlayers(ctx, bidderSquad._id)
      : [];
    const requestedPlayers: Doc<"players">[] = [];
    for (const playerId of requestedIds) {
      const player = await ctx.db.get(playerId);
      if (player) requestedPlayers.push(player);
    }
    const offeredPlayers: Doc<"players">[] = [];
    for (const playerId of offeredIds) {
      const player = await ctx.db.get(playerId);
      if (player) offeredPlayers.push(player);
    }

    const locked = await lockedCash(ctx, tournament._id, offer.bidderPresidentId, offerId);
    const bidderBudget = Math.max(
      0,
      (bidderPresident?.budget ?? 0) - locked,
    );

    const intent: MarketIntent = {
      type: offer.type as OfferType,
      cash: offer.cash,
      requested: requestedPlayers.map(toOfferPlayer),
      offered: offeredPlayers.map(toOfferPlayer),
    };

    const evaluation = evaluateOffer({
      rules,
      intent,
      bidderSquad: bidderPlayers,
      bidderBudget,
      bidderClubName: bidderClub?.name,
      sellerSquad: squadPlayers,
      sellerBudget: president.budget,
      sellerClubName: club.name,
      sellerLabel: "Tu plantilla",
    });

    if (!evaluation.passed) {
      throw new ConvexError(
        `No puedes aceptar esta operación: ${evaluation.blockers[0].detail}`,
      );
    }

    await ctx.db.patch(offerId, {
      status: "reservada",
      updatedAt: now,
      agreedAt: now,
      lastValidation: `${evaluation.checks.filter((c) => c.passed).length}/${evaluation.checks.length} comprobaciones superadas en la aceptación`,
      message: message ?? offer.message,
    });

    await logAudit(ctx, {
      tournamentId: tournament._id,
      clubId: club._id,
      actorUserId: userId,
      actorName: president.displayName,
      action: "Acuerdo reservado",
      entity: "offer",
      entityId: offerId,
      detail: `${president.nickname} aceptó la operación ${await shortId(offerId)} (${describeIntent(intent)}). Los jugadores implicados quedan comprometidos hasta la validación final.`,
    });

    return { status: "reservada" as OfferStatus };
  },
});

/* ------------------------------------------------------------------ *
 * Cancel
 * ------------------------------------------------------------------ */

export const cancelOffer = mutation({
  args: { offerId: v.id("offers"), reason: v.optional(v.string()) },
  handler: async (ctx, { offerId, reason }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Inicia sesión para cancelar una operación.");
    const { tournament, president } = await loadMarketContext(ctx, userId);

    const offer = await ctx.db.get(offerId);
    if (!offer || offer.tournamentId !== tournament._id) {
      throw new ConvexError("La operación no pertenece a este torneo.");
    }
    const isBidder = offer.bidderPresidentId === president._id;
    const isSeller = offer.sellerPresidentId === president._id;
    if (!isBidder && !isSeller) {
      throw new ConvexError("Solo las partes implicadas pueden cancelar la operación.");
    }
    if (!["enviada", "negociacion", "aceptada", "reservada"].includes(offer.status)) {
      throw new ConvexError(
        `Una operación ${OFFER_STATUS_META[offer.status as OfferStatus].label.toLowerCase()} no se puede cancelar.`,
      );
    }

    await ctx.db.patch(offerId, {
      status: "cancelada",
      updatedAt: Date.now(),
      invalidReason: reason,
    });
    await logAudit(ctx, {
      tournamentId: tournament._id,
      clubId: president.clubId,
      actorUserId: userId,
      actorName: president.displayName,
      action: "Operación cancelada",
      entity: "offer",
      entityId: offerId,
      detail: `${president.nickname} canceló la operación ${await shortId(offerId)}${reason ? ` · motivo: ${reason}` : ""}`,
    });

    return { status: "cancelada" as OfferStatus };
  },
});

/* ------------------------------------------------------------------ *
 * Execution
 * ------------------------------------------------------------------ */

type ExecutionOutcome = { executed: boolean; message: string };

/**
 * Applies an agreed operation: ownership moves, budgets move, lineups are
 * cleaned up and everything is audited. Only called after a successful
 * `evaluateExecution`.
 */
async function applyExecution(
  ctx: MutationCtx,
  offer: Doc<"offers">,
  params: { tournamentId: Id<"tournaments">; actorUserId: Id<"users">; actorName: string },
): Promise<void> {
  const now = Date.now();
  const { tournamentId, actorUserId, actorName } = params;

  const bidderPresident = await ctx.db.get(offer.bidderPresidentId);
  const bidderClub = await ctx.db.get(offer.bidderClubId);
  const bidderSquad = await ctx.db
    .query("squads")
    .withIndex("by_club", (q) => q.eq("clubId", offer.bidderClubId))
    .first();
  const sellerPresident = offer.sellerPresidentId
    ? await ctx.db.get(offer.sellerPresidentId)
    : null;
  const sellerClub = offer.sellerClubId ? await ctx.db.get(offer.sellerClubId) : null;
  const sellerSquad = offer.sellerClubId
    ? await ctx.db
        .query("squads")
        .withIndex("by_club", (q) => q.eq("clubId", offer.sellerClubId!))
        .first()
    : null;

  if (!bidderPresident || !bidderSquad || !bidderClub) {
    throw new ConvexError("No se pudo aplicar la operación: falta información del club comprador.");
  }

  const affectedSquads = new Map<string, Doc<"squads">>();
  if (bidderSquad) affectedSquads.set(bidderSquad._id as string, bidderSquad);
  if (sellerSquad) affectedSquads.set(sellerSquad._id as string, sellerSquad);

  /** Moves an existing ownership row, or registers a free agent for the first time. */
  const assignPlayer = async (
    playerId: Id<"players">,
    destination: {
      clubId: Id<"clubs">;
      squadId: Id<"squads">;
      presidentId: Id<"presidents">;
    },
  ) => {
    const rows = await ctx.db
      .query("squadPlayers")
      .withIndex("by_player", (q) => q.eq("playerId", playerId))
      .collect();
    const row = rows.find((item) => item.tournamentId === tournamentId) ?? null;

    if (row) {
      await ctx.db.patch(row._id, {
        clubId: destination.clubId,
        squadId: destination.squadId,
        presidentId: destination.presidentId,
        availability: "neutro",
        joinedAt: now,
      });
      return;
    }

    const player = await ctx.db.get(playerId);
    if (!player) {
      throw new ConvexError(
        "La operación no puede ejecutarse: uno de los jugadores ya no existe en la base de datos.",
      );
    }
    await ctx.db.insert("squadPlayers", {
      tournamentId,
      clubId: destination.clubId,
      squadId: destination.squadId,
      playerId,
      presidentId: destination.presidentId,
      availability: "neutro",
      ovrAtJoin: player.ovr,
      valueAtJoin: player.value,
      joinedAt: now,
    });
  };

  // Requested players join the bidder.
  for (const playerId of offer.requestedPlayerIds) {
    await assignPlayer(playerId, {
      clubId: bidderClub._id,
      squadId: bidderSquad._id,
      presidentId: bidderPresident._id,
    });
  }

  // Offered players join the seller (trades only).
  if (sellerClub && sellerSquad && sellerPresident) {
    for (const playerId of offer.offeredPlayerIds) {
      await assignPlayer(playerId, {
        clubId: sellerClub._id,
        squadId: sellerSquad._id,
        presidentId: sellerPresident._id,
      });
    }
  }

  // Budgets: cash flows from bidder to seller (or disappears for a free agent).
  if (offer.cash > 0) {
    await ctx.db.patch(bidderPresident._id, {
      budget: Math.max(0, bidderPresident.budget - offer.cash),
    });
    if (sellerPresident) {
      await ctx.db.patch(sellerPresident._id, {
        budget: sellerPresident.budget + offer.cash,
      });
    }
  }

  // Lineups: a departed player can never stay in the XI.
  const departed = new Set(
    [...offer.offeredPlayerIds, ...(sellerSquad ? offer.requestedPlayerIds : [])].map(
      (id) => id as string,
    ),
  );
  if (departed.size > 0) {
    for (const squad of affectedSquads.values()) {
      const nextLineup = squad.lineup.map((slot) =>
        slot.playerId && departed.has(slot.playerId)
          ? { slotId: slot.slotId, playerId: null }
          : slot,
      );
      const changed = nextLineup.some(
        (slot, index) => slot.playerId !== squad.lineup[index]?.playerId,
      );
      if (changed) {
        await ctx.db.patch(squad._id, { lineup: nextLineup, lineupUpdatedAt: now });
      }
    }
  }

  await ctx.db.patch(offer._id, {
    status: "ejecutada",
    updatedAt: now,
    executedAt: now,
  });

  const requestedNames = (
    await Promise.all(offer.requestedPlayerIds.map((id) => ctx.db.get(id)))
  )
    .map((player) => player?.name)
    .filter(Boolean)
    .join(", ");
  const offeredNames = (
    await Promise.all(offer.offeredPlayerIds.map((id) => ctx.db.get(id)))
  )
    .map((player) => player?.name)
    .filter(Boolean)
    .join(", ");

  const detail = sellerClub
    ? `${requestedNames} → ${bidderClub.name}${offeredNames ? ` · ${offeredNames} → ${sellerClub.name}` : ""}${offer.cash > 0 ? ` · ${formatMoney(offer.cash)}` : ""}`
    : `${requestedNames} firma como agente libre por ${bidderClub.name} · ${formatMoney(offer.cash)} de presupuesto`;

  await logAudit(ctx, {
    tournamentId,
    clubId: bidderClub._id,
    actorUserId,
    actorName,
    action: sellerClub ? "Operación ejecutada" : "Fichaje ejecutado",
    entity: "offer",
    entityId: offer._id,
    detail: `${detail} · operación ${await shortId(offer._id)}`,
  });
  if (sellerClub) {
    await logAudit(ctx, {
      tournamentId,
      clubId: sellerClub._id,
      actorUserId,
      actorName,
      action: "Operación ejecutada",
      entity: "offer",
      entityId: offer._id,
      detail: `${detail} · operación ${await shortId(offer._id)}`,
    });
  }
}

/** Executes when the tournament state allows it; otherwise reserves the deal. */
export async function tryExecute(
  ctx: MutationCtx,
  offerId: Id<"offers">,
  president: Doc<"presidents">,
  actorUserId: Id<"users">,
): Promise<ExecutionOutcome> {
  const offer = await ctx.db.get(offerId);
  if (!offer) return { executed: false, message: "La operación ya no existe." };
  // Resolved from the operation itself so it always targets the right tournament.
  const tournament = await ctx.db.get(offer.tournamentId);
  if (!tournament) return { executed: false, message: "El torneo no está disponible." };

  const now = Date.now();
  if (!tournament.marketOpen || !tournamentAllowsOperations(tournament.status)) {
    await ctx.db.patch(offerId, {
      status: "reservada",
      updatedAt: now,
      agreedAt: offer.agreedAt ?? now,
      lastValidation: "Pendiente: la ventana de mercado está cerrada",
    });
    await logAudit(ctx, {
      tournamentId: tournament._id,
      clubId: offer.bidderClubId,
      actorUserId,
      actorName: president.displayName,
      action: "Operación reservada",
      entity: "offer",
      entityId: offerId,
      detail: `La operación ${await shortId(offerId)} queda reservada hasta que Administración abra la ventana de mercado.`,
    });
    return {
      executed: false,
      message:
        "Acuerdo reservado: se ejecutará cuando Administración abra la ventana de mercado.",
    };
  }

  const validation = await validateOfferExecution(ctx, offer);
  if (!validation.passed) {
    await ctx.db.patch(offerId, {
      status: "invalidada",
      updatedAt: now,
      invalidReason: validation.reasons[0],
    });
    await logAudit(ctx, {
      tournamentId: tournament._id,
      clubId: offer.bidderClubId,
      actorUserId,
      actorName: president.displayName,
      action: "Operación invalidada",
      entity: "offer",
      entityId: offerId,
      detail: validation.reasons[0] ?? "La validación final no fue superada.",
    });
    return {
      executed: false,
      message: validation.reasons[0] ?? "La operación no superó la validación final.",
    };
  }

  await applyExecution(ctx, offer, {
    tournamentId: tournament._id,
    actorUserId,
    actorName: president.displayName,
  });
  return { executed: true, message: "Operación ejecutada y registrada en la auditoría." };
}

/** Final validation shared by `tryExecute` and the admin control panel. */
export async function validateOfferExecution(
  ctx: QueryCtx,
  offer: Doc<"offers">,
): Promise<{ checks: RuleCheck[]; passed: boolean; reasons: string[] }> {
  const tournament = offer.tournamentId
    ? await ctx.db.get(offer.tournamentId)
    : null;
  if (!tournament) {
    return {
      checks: [],
      passed: false,
      reasons: ["El torneo de la operación ya no existe."],
    };
  }
  const rules = await loadRules(ctx, tournament._id);
  const ownership = await ownershipRows(ctx, tournament._id);

  const bidderClub = await ctx.db.get(offer.bidderClubId);
  const sellerClub = offer.sellerClubId ? await ctx.db.get(offer.sellerClubId) : null;
  const bidderPresident = await ctx.db.get(offer.bidderPresidentId);
  const sellerPresident = offer.sellerPresidentId
    ? await ctx.db.get(offer.sellerPresidentId)
    : null;
  const bidderSquadRow = await ctx.db
    .query("squads")
    .withIndex("by_club", (q) => q.eq("clubId", offer.bidderClubId))
    .first();
  const sellerSquadRow = offer.sellerClubId
    ? await ctx.db
        .query("squads")
        .withIndex("by_club", (q) => q.eq("clubId", offer.sellerClubId!))
        .first()
    : null;

  const bidderSquad = bidderSquadRow ? await loadSquadPlayers(ctx, bidderSquadRow._id) : [];
  const sellerSquadPlayers = sellerSquadRow
    ? await loadSquadPlayers(ctx, sellerSquadRow._id)
    : null;

  const requested: Doc<"players">[] = [];
  const requestedOwnership: OwnershipState[] = [];
  for (const playerId of offer.requestedPlayerIds) {
    const player = await ctx.db.get(playerId);
    if (player) requested.push(player);
    const row = ownership.get(playerId as string);
    requestedOwnership.push(
      !row
        ? "free"
        : row.clubId === offer.sellerClubId
          ? "seller"
          : row.clubId === offer.bidderClubId
            ? "mine"
            : "other",
    );
  }
  const offered: Doc<"players">[] = [];
  const offeredOwnership: OwnershipState[] = [];
  for (const playerId of offer.offeredPlayerIds) {
    const player = await ctx.db.get(playerId);
    if (player) offered.push(player);
    const row = ownership.get(playerId as string);
    offeredOwnership.push(
      !row
        ? "missing"
        : row.clubId === offer.bidderClubId
          ? "mine"
          : row.clubId === offer.sellerClubId
            ? "seller"
            : "other",
    );
  }

  const intent: MarketIntent = {
    type: offer.type as OfferType,
    cash: offer.cash,
    requested: requested.map(toOfferPlayer),
    offered: offered.map(toOfferPlayer),
  };

  const result = evaluateExecution({
    rules,
    intent,
    bidderSquad,
    bidderBudget: bidderPresident?.budget ?? 0,
    bidderClubName: bidderClub?.name,
    sellerSquad: sellerClub ? sellerSquadPlayers : null,
    sellerBudget: sellerPresident?.budget ?? 0,
    sellerClubName: sellerClub?.name,
    requestedOwnership,
    offeredOwnership,
    tournamentAllowsOperations: tournamentAllowsOperations(tournament.status),
    sellerActive: offer.sellerPresidentId ? Boolean(sellerPresident) : true,
  });

  return result;
}

/** Admin control: opens the "draft moment" and executes every reserved deal. */
export const executeReserved = mutation({
  args: { offerId: v.optional(v.id("offers")) },
  handler: async (ctx, { offerId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Inicia sesión para ejecutar operaciones.");
    const tournament = await getTournament(ctx);
    if (!tournament) throw new ConvexError("El torneo no está disponible.");

    const admin = await loadAdmin(ctx, tournament._id, userId);
    if (!admin) {
      throw new ConvexError(
        "Solo Administración puede abrir la ventana y ejecutar las operaciones acordadas.",
      );
    }
    if (admin.role !== "principal" && !admin.permissions.includes("mercado")) {
      throw new ConvexError(
        "Tu rol de Co-Administrador no incluye el permiso de mercado.",
      );
    }

    const user = await ctx.db.get(userId);
    const actorName = user?.name ?? "Administración";

    const all = await loadTournamentOffers(ctx, tournament._id);
    const pending = offerId
      ? all.filter((offer) => offer._id === offerId)
      : all.filter((offer) => offer.status === "reservada" || offer.status === "aceptada");

    if (pending.length === 0) {
      return { executed: 0, invalidated: 0, details: [] as string[] };
    }

    const details: string[] = [];
    let executed = 0;
    let invalidated = 0;

    for (const offer of pending) {
      const validation = await validateOfferExecution(ctx, offer);
      if (!validation.passed) {
        invalidated += 1;
        const reason =
          validation.reasons[0] ?? "La operación no superó la validación final.";
        await ctx.db.patch(offer._id, {
          status: "invalidada",
          updatedAt: Date.now(),
          invalidReason: reason,
          lastValidation: "Validación final fallida",
        });
        await logAudit(ctx, {
          tournamentId: tournament._id,
          clubId: offer.bidderClubId,
          actorUserId: userId,
          actorName,
          action: "Operación invalidada en la validación final",
          entity: "offer",
          entityId: offer._id,
          detail: `Operación ${await shortId(offer._id)}: ${reason}`,
        });
        details.push(`⚠ Operación ${await shortId(offer._id)} no ejecutada · ${reason}`);
        continue;
      }

      await applyExecution(ctx, offer, {
        tournamentId: tournament._id,
        actorUserId: userId,
        actorName,
      });
      await ctx.db.patch(offer._id, {
        lastValidation: "Validación final superada",
      });
      executed += 1;
      details.push(`✔ Operación ${await shortId(offer._id)} ejecutada`);
    }

    if (executed > 0 || invalidated > 0) {
      await logAudit(ctx, {
        tournamentId: tournament._id,
        actorUserId: userId,
        actorName,
        action: "Validación final ejecutada",
        entity: "tournament",
        entityId: tournament._id,
        detail: `${executed} operación(es) ejecutadas · ${invalidated} invalidadas`,
      });
    }

    return { executed, invalidated, details };
  },
});

/* ------------------------------------------------------------------ *
 * Offer detail (full validation report)
 * ------------------------------------------------------------------ */

export const validateOffer = query({
  args: { offerId: v.id("offers") },
  handler: async (ctx, { offerId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const tournament = await getTournament(ctx);
    if (!tournament) return null;
    const president = await loadPresident(ctx, tournament._id, userId);
    const admin = await loadAdmin(ctx, tournament._id, userId);

    const offer = await ctx.db.get(offerId);
    if (!offer || offer.tournamentId !== tournament._id) return null;

    const isParty =
      president !== null &&
      (offer.bidderPresidentId === president._id ||
        offer.sellerPresidentId === president._id);
    if (!isParty && !admin) return null;

    const validation = await validateOfferExecution(ctx, offer);
    return {
      checks: validation.checks,
      passed: validation.passed,
      reasons: validation.reasons,
    };
  },
});

/* ------------------------------------------------------------------ *
 * Guidance for the offer dialog
 * ------------------------------------------------------------------ */

export const guidance = query({
  args: { requestedPlayerIds: idList, offeredPlayerIds: idList, cash: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const { tournament, rules, president, club, squadPlayers } =
      await loadMarketContext(ctx, userId);

    const ownership = await ownershipRows(ctx, tournament._id);
    const requested: Doc<"players">[] = [];
    for (const playerId of args.requestedPlayerIds) {
      const player = await ctx.db.get(playerId);
      if (player) requested.push(player);
    }
    const offered: Doc<"players">[] = [];
    for (const playerId of args.offeredPlayerIds) {
      const player = await ctx.db.get(playerId);
      if (player) offered.push(player);
    }

    const sellerRow = requested
      .map((player) => ownership.get(player._id as string) ?? null)
      .find((row) => row !== null && row !== undefined);
    const sellerClub = sellerRow ? await ctx.db.get(sellerRow.clubId) : null;
    const sellerPresident = sellerRow
      ? await ctx.db
          .query("presidents")
          .withIndex("by_club", (q) => q.eq("clubId", sellerRow.clubId))
          .first()
      : null;
    const sellerSquadRow = sellerPresident
      ? await ctx.db
          .query("squads")
          .withIndex("by_club", (q) => q.eq("clubId", sellerPresident.clubId))
          .first()
      : null;
    const sellerPlayers = sellerSquadRow
      ? await loadSquadPlayers(ctx, sellerSquadRow._id)
      : null;

    const locked = await lockedCash(ctx, tournament._id, president._id);
    const spendable = Math.max(0, president.budget - locked);
    const intent: MarketIntent = {
      type: offered.length > 0 ? "trade" : "cash",
      cash: args.cash,
      requested: requested.map(toOfferPlayer),
      offered: offered.map(toOfferPlayer),
    };

    const evaluation = evaluateOffer({
      rules,
      intent,
      bidderSquad: squadPlayers,
      bidderBudget: spendable,
      bidderClubName: club.name,
      sellerSquad: sellerPlayers,
      sellerBudget: sellerPresident?.budget ?? 0,
      sellerClubName: sellerClub?.name,
      sellerLabel: `Plantilla de ${sellerClub?.name ?? "agente libre"}`,
    });

    const freeAgentDeal = requested.every(
      (player) => !ownership.has(player._id as string),
    );
    const reference = requested.reduce((sum, player) => sum + player.value, 0);

    return {
      freeAgentDeal,
      minimumCash: freeAgentDeal ? reference : 0,
      guidance: offerGuidance(reference, president.budget, locked),
      spendable,
      sellerClubName: sellerClub?.name ?? null,
      sellerNickname: sellerPresident
        ? (await ctx.db.get(sellerPresident.userId))?.name ?? sellerPresident.nickname
        : null,
      checks: evaluation.checks,
      passed: evaluation.passed,
      blockers: evaluation.blockers.map((check) => check.detail),
    };
  },
});

export type { OfferPlayerLite, OfferView };
