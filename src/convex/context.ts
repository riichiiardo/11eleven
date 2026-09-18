import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type {
  AdminView,
  AuditEntryView,
  ClubView,
  MyAction,
  NextEventView,
  OfferPlayerLite,
  OfferView,
  PresidentView,
  TournamentView,
} from "./appTypes";
import type { OfferStatus } from "./marketEngine";
import {
  CLUBS,
  FREE_AGENTS,
  FREE_AGENT_CLUB_NAME,
  FREE_AGENT_LEAGUE,
  TOURNAMENT_SEED,
  toEuros,
} from "./footballData";
import {
  DEFAULT_FORMATION,
  DEFAULT_RULES,
  FC_VERSION,
  TOURNAMENT_STATUS_META,
  autoLineup,
  groupOf,
  type Lineup,
  type PlayerAvailability,
  type SquadPlayerView,
  type TournamentRules,
  type TournamentStatus,
} from "./rulesEngine";

export const TOURNAMENT_CODE = "11eleven-foundation";
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ *
 * Tournament
 * ------------------------------------------------------------------ */

export async function getTournament(
  ctx: QueryCtx,
): Promise<Doc<"tournaments"> | null> {
  return await ctx.db
    .query("tournaments")
    .withIndex("by_code", (q) => q.eq("code", TOURNAMENT_CODE))
    .first();
}

export async function loadRules(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
): Promise<TournamentRules> {
  const doc = await ctx.db
    .query("tournamentRules")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .first();
  if (!doc) return DEFAULT_RULES;
  return {
    budget: doc.budget,
    squadSize: doc.squadSize,
    gkMin: doc.gkMin,
    gkMax: doc.gkMax,
    defMin: doc.defMin,
    defMax: doc.defMax,
    midMin: doc.midMin,
    midMax: doc.midMax,
    fwdMin: doc.fwdMin,
    fwdMax: doc.fwdMax,
    maxPerRealClub: doc.maxPerRealClub,
    minOvr: doc.minOvr,
    maxU21: doc.maxU21,
    lineupLockHours: doc.lineupLockHours,
  };
}

export function toTournamentView(doc: Doc<"tournaments">): TournamentView {
  const status = doc.status as TournamentStatus;
  const meta = TOURNAMENT_STATUS_META[status] ?? TOURNAMENT_STATUS_META.configuracion;
  return {
    id: doc._id,
    code: doc.code,
    name: doc.name,
    season: doc.season,
    status,
    statusLabel: meta.label,
    statusHint: meta.hint,
    currentMatchday: doc.currentMatchday,
    totalMatchdays: doc.totalMatchdays,
    marketOpen: doc.marketOpen,
    nextMatchdayAt: doc.nextMatchdayAt ?? null,
  };
}

/** Seeds clubs + the versioned player catalogue. Called once per deployment. */
export async function seedTournament(
  ctx: MutationCtx,
): Promise<Id<"tournaments">> {
  const now = Date.now();
  const tournamentId = await ctx.db.insert("tournaments", {
    code: TOURNAMENT_CODE,
    name: TOURNAMENT_SEED.name,
    season: TOURNAMENT_SEED.season,
    status: "competicion",
    currentMatchday: TOURNAMENT_SEED.currentMatchday,
    totalMatchdays: TOURNAMENT_SEED.totalMatchdays,
    marketOpen: false,
    nextMatchdayAt: now + 3 * 24 * 60 * 60 * 1000,
    createdAt: now,
  });

  await ctx.db.insert("tournamentRules", {
    tournamentId,
    ...DEFAULT_RULES,
    updatedAt: now,
  });

  for (const club of CLUBS) {
    const clubId = await ctx.db.insert("clubs", {
      tournamentId,
      name: club.name,
      shortName: club.shortName,
      league: club.league,
      country: club.country,
      colorPrimary: club.colors[0],
      colorSecondary: club.colors[1],
    });

    for (const [name, position, ovr, age, valueM, nationality, flag] of club.players) {
      await ctx.db.insert("players", {
        name,
        position,
        group: groupOf(position),
        ovr,
        age,
        value: toEuros(valueM),
        nationality,
        flag,
        realClub: club.name,
        realLeague: club.league,
        fcVersion: FC_VERSION,
      });
    }

    await ctx.db.insert("auditLog", {
      tournamentId,
      clubId,
      actorName: "Administración",
      action: "Club habilitado",
      entity: "club",
      entityId: clubId,
      detail: `${club.name} (${club.league}) disponible para presidencia · ${club.players.length} jugadores importados`,
      createdAt: now,
    });
  }

  const freeAgentVersion = await seedFreeAgents(ctx, tournamentId);

  await ctx.db.insert("auditLog", {
    tournamentId,
    actorName: "Sistema",
    action: "Torneo creado",
    entity: "tournament",
    entityId: tournamentId,
    detail: `${TOURNAMENT_SEED.name} · ${CLUBS.length} clubes · ${CLUBS.length * 20} jugadores · ${freeAgentVersion} agentes libres · ${FC_VERSION}`,
    createdAt: now,
  });

  return tournamentId;
}

/**
 * Free agents are part of the versioned snapshot, not of a club. Adding them is
 * idempotent so an existing deployment can pick them up on the next bootstrap.
 */
export async function seedFreeAgents(
  ctx: MutationCtx,
  tournamentId: Id<"tournaments">,
): Promise<number> {
  const existing = await ctx.db
    .query("players")
    .withIndex("by_real_club", (q) => q.eq("realClub", FREE_AGENT_CLUB_NAME))
    .collect();

  const known = new Set(existing.map((player) => player.name));
  let inserted = 0;

  for (const [name, position, ovr, age, valueM, nationality, flag] of FREE_AGENTS) {
    if (known.has(name)) continue;
    await ctx.db.insert("players", {
      name,
      position,
      group: groupOf(position),
      ovr,
      age,
      value: toEuros(valueM),
      nationality,
      flag,
      realClub: FREE_AGENT_CLUB_NAME,
      realLeague: FREE_AGENT_LEAGUE,
      fcVersion: FC_VERSION,
    });
    inserted += 1;
  }

  if (inserted > 0) {
    await ctx.db.insert("auditLog", {
      tournamentId,
      actorName: "Sistema",
      action: "Agentes libres importados",
      entity: "player",
      detail: `${inserted} jugadores sin club incorporados al mercado desde ${FC_VERSION}`,
      createdAt: Date.now(),
    });
  }

  return inserted;
}

/* ------------------------------------------------------------------ *
 * Admins
 * ------------------------------------------------------------------ */

export async function loadAdmin(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
  userId: Id<"users">,
): Promise<Doc<"tournamentAdmins"> | null> {
  const rows = await ctx.db
    .query("tournamentAdmins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return rows.find((row) => row.tournamentId === tournamentId) ?? null;
}

/* ------------------------------------------------------------------ *
 * Presidents + squads
 * ------------------------------------------------------------------ */

export function toSquadPlayerView(
  squadPlayer: Doc<"squadPlayers">,
  player: Doc<"players">,
): SquadPlayerView {
  return {
    squadPlayerId: squadPlayer._id,
    playerId: player._id,
    name: player.name,
    position: player.position,
    group: player.group,
    ovr: player.ovr,
    age: player.age,
    value: player.value,
    nationality: player.nationality,
    flag: player.flag,
    availability: squadPlayer.availability as PlayerAvailability,
    realClub: player.realClub,
    realLeague: player.realLeague,
    fcVersion: player.fcVersion,
  };
}

export async function loadSquadPlayers(
  ctx: QueryCtx,
  squadId: Id<"squads">,
): Promise<SquadPlayerView[]> {
  const rows = await ctx.db
    .query("squadPlayers")
    .withIndex("by_squad", (q) => q.eq("squadId", squadId))
    .collect();
  const views: SquadPlayerView[] = [];
  for (const row of rows) {
    const player = await ctx.db.get(row.playerId);
    if (!player) continue;
    views.push(toSquadPlayerView(row, player));
  }
  return views.sort((a, b) => b.ovr - a.ovr);
}

export async function loadPresident(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
  userId: Id<"users">,
): Promise<Doc<"presidents"> | null> {
  const rows = await ctx.db
    .query("presidents")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return rows.find((row) => row.tournamentId === tournamentId) ?? null;
}

/** Ownership chain: PLAYER -> SQUAD_OWNERSHIP -> PRESIDENT -> TOURNAMENT */
export async function createSquadForClub(
  ctx: MutationCtx,
  params: {
    tournamentId: Id<"tournaments">;
    clubId: Id<"clubs">;
    presidentId: Id<"presidents">;
    clubName: string;
  },
): Promise<{ squadId: Id<"squads">; size: number }> {
  const { tournamentId, clubId, presidentId, clubName } = params;
  const now = Date.now();

  const catalogue = await ctx.db
    .query("players")
    .withIndex("by_real_club", (q) => q.eq("realClub", clubName))
    .collect();

  const squadId = await ctx.db.insert("squads", {
    tournamentId,
    clubId,
    presidentId,
    formation: DEFAULT_FORMATION,
    lineup: [],
    lineupUpdatedAt: now,
    createdAt: now,
  });

  const views: SquadPlayerView[] = [];
  for (const player of catalogue) {
    const squadPlayerId = await ctx.db.insert("squadPlayers", {
      tournamentId,
      clubId,
      squadId,
      playerId: player._id,
      presidentId,
      availability: "neutro",
      ovrAtJoin: player.ovr,
      valueAtJoin: player.value,
      joinedAt: now,
    });
    views.push(
      toSquadPlayerView(
        {
          _id: squadPlayerId,
          _creationTime: now,
          tournamentId,
          clubId,
          squadId,
          playerId: player._id,
          presidentId,
          availability: "neutro",
          ovrAtJoin: player.ovr,
          valueAtJoin: player.value,
          joinedAt: now,
        },
        player,
      ),
    );
  }

  const lineup: Lineup = autoLineup(
    views.sort((a, b) => b.ovr - a.ovr),
    DEFAULT_FORMATION,
  );
  await ctx.db.patch(squadId, { lineup: lineup.slots });

  return { squadId, size: views.length };
}

/* ------------------------------------------------------------------ *
 * Views for the UI
 * ------------------------------------------------------------------ */

export async function buildClubViews(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
): Promise<ClubView[]> {
  const clubs = await ctx.db
    .query("clubs")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  const presidents = await ctx.db
    .query("presidents")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  const catalogue = await ctx.db.query("players").collect();

  const rosterByClub = new Map<string, { size: number; ovr: number; value: number }>();
  for (const player of catalogue) {
    const entry = rosterByClub.get(player.realClub) ?? { size: 0, ovr: 0, value: 0 };
    entry.size += 1;
    entry.ovr += player.ovr;
    entry.value += player.value;
    rosterByClub.set(player.realClub, entry);
  }

  const presidentByClub = new Map(
    presidents.map((president) => [president.clubId as string, president]),
  );

  const views: ClubView[] = [];
  for (const club of clubs) {
    const president = presidentByClub.get(club._id as string);
    const user = president ? await ctx.db.get(president.userId) : null;
    const roster = rosterByClub.get(club.name) ?? { size: 0, ovr: 0, value: 0 };
    views.push({
      id: club._id,
      name: club.name,
      shortName: club.shortName,
      league: club.league,
      country: club.country,
      colorPrimary: club.colorPrimary,
      colorSecondary: club.colorSecondary,
      rosterSize: roster.size,
      averageOvr: roster.size ? Math.round((roster.ovr / roster.size) * 10) / 10 : 0,
      totalValue: roster.value,
      presidentNickname: president?.nickname ?? null,
      presidentName: president ? user?.name ?? president.displayName : null,
    });
  }

  return views.sort((a, b) => a.name.localeCompare(b.name));
}

export async function buildPresidents(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
): Promise<PresidentView[]> {
  const presidents = await ctx.db
    .query("presidents")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();

  const views: PresidentView[] = [];
  for (const president of presidents) {
    const club = await ctx.db.get(president.clubId);
    const user = await ctx.db.get(president.userId);
    const admin = await loadAdmin(ctx, tournamentId, president.userId);
    const squad = await ctx.db
      .query("squads")
      .withIndex("by_president", (q) => q.eq("presidentId", president._id))
      .first();
    const squadPlayers = squad
      ? await ctx.db
          .query("squadPlayers")
          .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
          .collect()
      : [];

    views.push({
      id: president._id,
      userId: president.userId,
      nickname: president.nickname,
      displayName: president.displayName,
      email: user?.email ?? "—",
      clubId: president.clubId,
      clubName: club?.name ?? "Club sin asignar",
      clubShortName: club?.shortName ?? "—",
      clubColors: [
        club?.colorPrimary ?? "#1d4ed8",
        club?.colorSecondary ?? "#0b1a30",
      ],
      budget: president.budget,
      joinedAt: president.joinedAt,
      isAdmin: Boolean(admin),
      adminRole: admin?.role ?? null,
      squadSize: squadPlayers.length,
    });
  }

  return views.sort((a, b) => b.joinedAt - a.joinedAt);
}

export async function buildAdmins(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
): Promise<AdminView[]> {
  const admins = await ctx.db
    .query("tournamentAdmins")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  const views: AdminView[] = [];
  for (const admin of admins) {
    const user = await ctx.db.get(admin.userId);
    views.push({
      id: admin._id,
      userId: admin.userId,
      displayName: user?.name ?? "Administrador",
      email: user?.email ?? "—",
      role: admin.role,
      permissions: admin.permissions,
      createdAt: admin.createdAt,
    });
  }
  return views.sort((a, b) => a.createdAt - b.createdAt);
}

export async function buildActivity(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
  limit = 12,
  clubId?: Id<"clubs">,
): Promise<AuditEntryView[]> {
  const rows = clubId
    ? await ctx.db
        .query("auditLog")
        .withIndex("by_club", (q) => q.eq("clubId", clubId))
        .collect()
    : await ctx.db
        .query("auditLog")
        .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
        .collect();

  const sorted = rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  const clubIds = [...new Set(sorted.map((row) => row.clubId).filter(Boolean))];
  const clubNames = new Map<string, string>();
  for (const id of clubIds) {
    const club = await ctx.db.get(id as Id<"clubs">);
    if (club) clubNames.set(id as string, club.name);
  }

  return sorted.map((row) => ({
    id: row._id,
    action: row.action,
    actorName: row.actorName,
    detail: row.detail,
    entity: row.entity,
    clubName: row.clubId ? clubNames.get(row.clubId as string) ?? null : null,
    createdAt: row.createdAt,
  }));
}

export async function logAudit(
  ctx: MutationCtx,
  entry: {
    tournamentId: Id<"tournaments">;
    clubId?: Id<"clubs">;
    actorUserId?: Id<"users">;
    actorName: string;
    action: string;
    entity: string;
    entityId?: string;
    detail: string;
  },
): Promise<void> {
  await ctx.db.insert("auditLog", {
    ...entry,
    createdAt: Date.now(),
  });
}

/* ------------------------------------------------------------------ *
 * Market views
 * ------------------------------------------------------------------ */

export async function loadTournamentOffers(
  ctx: QueryCtx,
  tournamentId: Id<"tournaments">,
): Promise<Doc<"offers">[]> {
  const rows = await ctx.db
    .query("offers")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Turns raw offer rows into the view the UI reasons about: which side the
 * President is on, what can be done next, and why a reserved agreement is not
 * executable yet.
 */
export async function buildOffers(
  ctx: QueryCtx,
  params: {
    tournamentId: Id<"tournaments">;
    offers: Doc<"offers">[];
    viewerPresidentId: Id<"presidents"> | null;
    tournamentAllowsOperations: boolean;
    marketOpen: boolean;
  },
): Promise<OfferView[]> {
  const { tournamentId, offers, viewerPresidentId, tournamentAllowsOperations, marketOpen } =
    params;

  const clubCache = new Map<string, Doc<"clubs"> | null>();
  const presidentCache = new Map<string, Doc<"presidents"> | null>();
  const userCache = new Map<string, string>();
  const playerCache = new Map<string, Doc<"players"> | null>();
  const ownershipCache = new Map<string, Doc<"squadPlayers"> | null>();

  const getClub = async (id: Id<"clubs"> | undefined) => {
    if (!id) return null;
    if (!clubCache.has(id)) clubCache.set(id, await ctx.db.get(id));
    return clubCache.get(id) ?? null;
  };

  const getPresident = async (id: Id<"presidents"> | undefined) => {
    if (!id) return null;
    if (!presidentCache.has(id)) presidentCache.set(id, await ctx.db.get(id));
    return presidentCache.get(id) ?? null;
  };

  const getPresidentName = async (id: Id<"presidents"> | undefined) => {
    const president = await getPresident(id);
    if (!president) return "—";
    if (!userCache.has(president.userId)) {
      const user = await ctx.db.get(president.userId);
      userCache.set(president.userId, user?.name ?? president.displayName);
    }
    return userCache.get(president.userId) ?? president.displayName;
  };

  const getPlayer = async (id: Id<"players">) => {
    if (!playerCache.has(id)) playerCache.set(id, await ctx.db.get(id));
    return playerCache.get(id) ?? null;
  };

  // Ownership is the key of every market decision.
  const squadPlayers = await ctx.db
    .query("squadPlayers")
    .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
    .collect();
  for (const row of squadPlayers) ownershipCache.set(row.playerId as string, row);

  const playerLite = async (
    playerId: Id<"players">,
  ): Promise<OfferPlayerLite | null> => {
    const player = await getPlayer(playerId);
    if (!player) return null;
    const ownership = ownershipCache.get(playerId as string) ?? null;
    const ownerClub = ownership ? await getClub(ownership.clubId) : null;
    return {
      playerId: player._id,
      name: player.name,
      position: player.position,
      group: player.group,
      ovr: player.ovr,
      age: player.age,
      value: player.value,
      flag: player.flag,
      clubName: ownerClub?.name ?? null,
    };
  };

  const views: OfferView[] = [];

  for (const offer of offers) {
    const bidderClub = await getClub(offer.bidderClubId);
    const sellerClub = await getClub(offer.sellerClubId);
    const requested = (
      await Promise.all(offer.requestedPlayerIds.map((id) => playerLite(id)))
    ).filter((player): player is OfferPlayerLite => Boolean(player));
    const offered = (
      await Promise.all(offer.offeredPlayerIds.map((id) => playerLite(id)))
    ).filter((player): player is OfferPlayerLite => Boolean(player));

    const side: OfferView["side"] =
      viewerPresidentId === null
        ? "sistema"
        : offer.bidderPresidentId === viewerPresidentId
          ? "enviada"
          : offer.sellerPresidentId === viewerPresidentId
            ? "recibida"
            : "sistema";

    const blockers: string[] = [];
    if (offer.status === "reservada" || offer.status === "aceptada") {
      if (!tournamentAllowsOperations) {
        blockers.push(
          "El torneo está suspendido o cancelado: ninguna operación se ejecuta en esta fase.",
        );
      }
      if (!marketOpen) {
        blockers.push(
          "La ventana de mercado está cerrada. La operación espera a que Administración la abra para ejecutarse.",
        );
      }
      for (const player of requested) {
        const ownership = ownershipCache.get(player.playerId as string) ?? null;
        const stillWithSeller = ownership
          ? offer.sellerClubId
            ? ownership.clubId === offer.sellerClubId
            : false
          : true;
        if (!stillWithSeller) {
          blockers.push(
            `${player.name} ya no pertenece a ${sellerClub?.name ?? "la lista de agentes libres"}: la operación quedó sin efecto.`,
          );
        }
      }
      for (const player of offered) {
        const ownership = ownershipCache.get(player.playerId as string) ?? null;
        if (!ownership || ownership.clubId !== offer.bidderClubId) {
          blockers.push(
            `${player.name} ya no está en la plantilla de ${bidderClub?.name ?? "tu club"}.`,
          );
        }
      }
    }

    views.push({
      id: offer._id,
      type: offer.type,
      status: offer.status as OfferStatus,
      cash: offer.cash,
      message: offer.message ?? null,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
      agreedAt: offer.agreedAt ?? null,
      executedAt: offer.executedAt ?? null,
      side,
      bidderNickname: (await getPresident(offer.bidderPresidentId))?.nickname ?? "—",
      bidderClubName: bidderClub?.name ?? "Club sin asignar",
      bidderClubColors: [
        bidderClub?.colorPrimary ?? "#1d4ed8",
        bidderClub?.colorSecondary ?? "#0b1a30",
      ],
      bidderIsMe: Boolean(
        viewerPresidentId && offer.bidderPresidentId === viewerPresidentId,
      ),
      sellerNickname: offer.sellerPresidentId
        ? (await getPresident(offer.sellerPresidentId))?.nickname ?? "—"
        : null,
      sellerClubName: sellerClub?.name ?? null,
      sellerClubColors: sellerClub
        ? [sellerClub.colorPrimary, sellerClub.colorSecondary]
        : null,
      requested,
      offered,
      canRespond:
        side === "recibida" && (offer.status === "enviada" || offer.status === "negociacion"),
      canCancel:
        (side === "enviada" || side === "recibida") &&
        ["enviada", "negociacion", "reservada", "aceptada"].includes(offer.status),
      blockers,
      invalidReason: offer.invalidReason ?? null,
    });
  }

  void getPresidentName;
  return views;
}

/* ------------------------------------------------------------------ *
 * Deadlines + "qué debo hacer"
 * ------------------------------------------------------------------ */

/**
 * Fixtures arrive with the competition module. Until then the control room
 * still needs an honest deadline: the next matchday and its lineup lock.
 */
export function buildNextEvent(
  tournament: Doc<"tournaments">,
  allClubs: ClubView[],
  myClubId: Id<"clubs">,
  rules: TournamentRules,
): NextEventView | null {
  if (!tournament.nextMatchdayAt) return null;
  const now = Date.now();

  // Roll the weekly window forward so a stale demo never shows a dead countdown.
  let kickoffAt = tournament.nextMatchdayAt;
  while (kickoffAt < now) kickoffAt += WEEK_MS;
  const lockAt = kickoffAt - rules.lineupLockHours * 60 * 60 * 1000;

  const index = allClubs.findIndex((club) => club.id === myClubId);
  const rivals = allClubs.filter((club) => club.id !== myClubId);
  const rival =
    index >= 0 && rivals.length > 0
      ? rivals[(tournament.currentMatchday + index) % rivals.length]
      : null;

  return {
    matchday: tournament.currentMatchday,
    kickoffAt,
    lockAt,
    locked: now >= lockAt,
    rivalName: rival?.name ?? null,
    rivalShortName: rival?.shortName ?? null,
    rivalColors: rival ? [rival.colorPrimary, rival.colorSecondary] : null,
  };
}

/** "Qué debo hacer" — derived, never a generic news block. */
export function buildActions(params: {
  isAdmin: boolean;
  squadSize: number;
  availability: Record<PlayerAvailability, number>;
  violations: { id: string; detail: string }[];
  lineupValid: boolean;
  lineupComplete: boolean;
  lockAt: number | null;
  rules: TournamentRules;
  market: { received: number; reserved: number; open: boolean };
}): MyAction[] {
  const actions: MyAction[] = [];
  const {
    isAdmin,
    squadSize,
    availability,
    violations,
    lineupValid,
    lineupComplete,
    lockAt,
    rules,
    market,
  } = params;

  if (market.received > 0) {
    actions.push({
      id: "offers-received",
      tone: "warning",
      title:
        market.received === 1
          ? "Tienes una oferta sin responder"
          : `Tienes ${market.received} ofertas sin responder`,
      description:
        "Otros Presidentes quieren operar contigo. Puedes aceptar, rechazar o enviar una contraoferta desde el panel de negociaciones.",
      action: { label: "Ver ofertas", to: "/dashboard/mercado/negociaciones" },
    });
  }

  if (market.reserved > 0) {
    actions.push({
      id: "offers-reserved",
      tone: "info",
      title:
        market.reserved === 1
          ? "Una operación acordada está reservada"
          : `${market.reserved} operaciones acordadas reservadas`,
      description:
        "Los jugadores implicados quedan comprometidos: se ejecutarán en la validación final, cuando Administración abra el mercado.",
      action: { label: "Ver operaciones", to: "/dashboard/mercado/negociaciones" },
    });
  }

  const slotsFree = rules.squadSize - squadSize;
  if (market.open && slotsFree > 0) {
    actions.push({
      id: "market-open",
      tone: "info",
      title: `Mercado abierto · ${slotsFree} plaza(s) libres`,
      description:
        "Puedes incorporar jugadores: el motor de reglas valida presupuesto, cupos por posición y sub-21 antes de enviar cualquier oferta.",
      action: { label: "Ir al mercado", to: "/dashboard/mercado" },
    });
  }

  const lockIn = lockAt ? lockAt - Date.now() : null;
  if (lockIn !== null && lockIn > 0 && lockIn < 12 * 60 * 60 * 1000) {
    actions.push({
      id: "lock",
      tone: lockIn < 3 * 60 * 60 * 1000 ? "danger" : "warning",
      title: "Cierre de alineación",
      description: lineupValid
        ? `Tu once ya es válido. La formación queda bloqueada ${rules.lineupLockHours} h antes del inicio de la jornada.`
        : `Revisa tu once: queda menos de ${Math.max(1, Math.round(lockIn / 3600000))} h y la alineación aún no cumple todas las reglas.`,
      action: { label: "Revisar once", to: "/dashboard/formacion" },
    });
  }

  if (!lineupComplete) {
    actions.push({
      id: "lineup-empty",
      tone: "warning",
      title: "Completa tu once titular",
      description:
        "Faltan jugadores por asignar en la formación activa. El motor valida cada posición mientras la construyes.",
      action: { label: "Ir a formación", to: "/dashboard/formacion" },
    });
  }

  if (!lineupValid && lineupComplete) {
    actions.push({
      id: "lineup-invalid",
      tone: "warning",
      title: "Tu alineación incumple una regla",
      description:
        "Puedes guardar la plantilla, pero la alineación no quedará fijada hasta que sea válida.",
      action: { label: "Ver qué falla", to: "/dashboard/formacion" },
    });
  }

  for (const violation of violations.slice(0, 2)) {
    actions.push({
      id: `rule-${violation.id}`,
      tone: "warning",
      title: "Regla del torneo incumplida",
      description: violation.detail,
      action: { label: "Ver reglas", to: "/dashboard/reglas" },
    });
  }

  if (availability.transferible + availability.negociacion === 0 && squadSize > 0) {
    actions.push({
      id: "availability",
      tone: "info",
      title: "Define la situación de tu plantilla",
      description:
        "Ningún jugador está marcado como transferible o en negociación. En el mercado nadie podrá ofertar por tu plantilla si todo está neutro.",
      action: { label: "Estado de jugadores", to: "/dashboard/club/estado" },
    });
  }

  if (isAdmin) {
    actions.push({
      id: "admin",
      tone: "info",
      title: "Eres Administrador del torneo",
      description:
        "Revisa reglas, presidentes y la auditoría del torneo desde el panel de administración.",
      action: { label: "Abrir administración", to: "/dashboard/admin" },
    });
  }

  return actions.slice(0, 4);
}
