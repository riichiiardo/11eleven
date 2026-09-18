import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

/* ------------------------------------------------------------------ *
 * 11Eleven domain validators
 * ------------------------------------------------------------------ */

export const positionValidator = v.union(
  v.literal("POR"),
  v.literal("LD"),
  v.literal("DFC"),
  v.literal("LI"),
  v.literal("MCD"),
  v.literal("MC"),
  v.literal("MCO"),
  v.literal("ED"),
  v.literal("EI"),
  v.literal("DC"),
);

export const positionGroupValidator = v.union(
  v.literal("GK"),
  v.literal("DEF"),
  v.literal("MID"),
  v.literal("FWD"),
);

/** Availability of a player inside a fantasy squad. */
export const availabilityValidator = v.union(
  v.literal("transferible"),
  v.literal("negociacion"),
  v.literal("neutro"),
  v.literal("intransferible"),
);

/** Tournament state machine. */
export const tournamentStatusValidator = v.union(
  v.literal("configuracion"),
  v.literal("inscripciones"),
  v.literal("seleccion_clubes"),
  v.literal("pre_draft"),
  v.literal("negociaciones"),
  v.literal("draft_abierto"),
  v.literal("draft_en_curso"),
  v.literal("draft_cerrado"),
  v.literal("plantillas_bloqueadas"),
  v.literal("competicion"),
  v.literal("cierre_jornada"),
  v.literal("suspendido"),
  v.literal("cancelado"),
);

export const adminRoleValidator = v.union(
  v.literal("principal"),
  v.literal("coAdmin"),
);

/** Market operation lifecycle (offer, trade, reservation, execution). */
export const offerStatusValidator = v.union(
  v.literal("borrador"),
  v.literal("enviada"),
  v.literal("negociacion"),
  v.literal("aceptada"),
  v.literal("reservada"),
  v.literal("ejecutada"),
  v.literal("rechazada"),
  v.literal("cancelada"),
  v.literal("expirada"),
  v.literal("invalidada"),
);

export const offerTypeValidator = v.union(v.literal("cash"), v.literal("trade"));

/** Draft lifecycle. The draft is the window where agreed operations execute. */
export const draftStatusValidator = v.union(
  v.literal("borrador"),
  v.literal("en_curso"),
  v.literal("pausado"),
  v.literal("cerrado"),
);

/** How a player entered a squad during the draft window. */
export const draftPickModeValidator = v.union(
  v.literal("turno"),
  v.literal("reserva"),
);

/** Fixture lifecycle (prompt §24: jornada anterior / actual / próxima). */
export const fixtureStatusValidator = v.union(
  v.literal("programado"),
  v.literal("en_curso"),
  v.literal("jugado"),
);

/** Permission keys a co-administrator can be granted. */
export const PERMISSIONS = [
  "configuracion",
  "presidentes",
  "jugadores",
  "mercado",
  "draft",
  "calendario",
  "noticias",
  "ia",
  "auditoria",
] as const;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    /* ----------------------------------------------------------------
     * Tournament core
     * ---------------------------------------------------------------- */

    tournaments: defineTable({
      code: v.string(),
      name: v.string(),
      season: v.string(),
      status: tournamentStatusValidator,
      currentMatchday: v.number(),
      totalMatchdays: v.number(),
      marketOpen: v.boolean(),
      nextMatchdayAt: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_code", ["code"]),

    tournamentRules: defineTable({
      tournamentId: v.id("tournaments"),
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
      updatedAt: v.number(),
      updatedBy: v.optional(v.id("users")),
    }).index("by_tournament", ["tournamentId"]),

    /** Admin is a ROLE inside a tournament, not a separate kind of user. */
    tournamentAdmins: defineTable({
      tournamentId: v.id("tournaments"),
      userId: v.id("users"),
      role: adminRoleValidator,
      permissions: v.array(v.string()),
      createdAt: v.number(),
    })
      .index("by_tournament", ["tournamentId"])
      .index("by_user", ["userId"]),

    /** A President owns one club per tournament. */
    presidents: defineTable({
      tournamentId: v.id("tournaments"),
      userId: v.id("users"),
      nickname: v.string(),
      displayName: v.string(),
      clubId: v.id("clubs"),
      budget: v.number(),
      joinedAt: v.number(),
    })
      .index("by_tournament", ["tournamentId"])
      .index("by_user", ["userId"])
      .index("by_club", ["clubId"]),

    /* ----------------------------------------------------------------
     * Clubs + player catalogue (versioned snapshot)
     * ---------------------------------------------------------------- */

    clubs: defineTable({
      tournamentId: v.id("tournaments"),
      name: v.string(),
      shortName: v.string(),
      league: v.string(),
      country: v.string(),
      colorPrimary: v.string(),
      colorSecondary: v.string(),
    })
      .index("by_tournament", ["tournamentId"])
      .index("by_league", ["league"]),

    players: defineTable({
      name: v.string(),
      position: positionValidator,
      group: positionGroupValidator,
      ovr: v.number(),
      age: v.number(),
      value: v.number(),
      nationality: v.string(),
      flag: v.string(),
      realClub: v.string(),
      realLeague: v.string(),
      fcVersion: v.string(),
    })
      .index("by_name", ["name"])
      .index("by_real_club", ["realClub"])
      .index("by_position", ["position"]),

    /* ----------------------------------------------------------------
     * Squad ownership: PLAYER -> SQUAD_OWNERSHIP -> PRESIDENT -> TOURNAMENT
     * ---------------------------------------------------------------- */

    squads: defineTable({
      tournamentId: v.id("tournaments"),
      clubId: v.id("clubs"),
      presidentId: v.id("presidents"),
      formation: v.string(),
      lineup: v.array(
        v.object({
          slotId: v.string(),
          playerId: v.union(v.string(), v.null()),
        }),
      ),
      lineupUpdatedAt: v.number(),
      createdAt: v.number(),
    })
      .index("by_tournament", ["tournamentId"])
      .index("by_club", ["clubId"])
      .index("by_president", ["presidentId"]),

    squadPlayers: defineTable({
      tournamentId: v.id("tournaments"),
      clubId: v.id("clubs"),
      squadId: v.id("squads"),
      playerId: v.id("players"),
      presidentId: v.id("presidents"),
      availability: availabilityValidator,
      ovrAtJoin: v.number(),
      valueAtJoin: v.number(),
      joinedAt: v.number(),
    })
      .index("by_tournament", ["tournamentId"])
      .index("by_squad", ["squadId"])
      .index("by_club", ["clubId"])
      .index("by_player", ["playerId"]),

    /* ----------------------------------------------------------------
     * Market: offers, trades and reserved agreements
     * ---------------------------------------------------------------- */

    offers: defineTable({
      tournamentId: v.id("tournaments"),
      type: offerTypeValidator,
      bidderPresidentId: v.id("presidents"),
      bidderClubId: v.id("clubs"),
      sellerPresidentId: v.optional(v.id("presidents")),
      sellerClubId: v.optional(v.id("clubs")),
      /** Players the bidder wants (from the seller or from the free-agent pool). */
      requestedPlayerIds: v.array(v.id("players")),
      /** Players the bidder gives away (trades only). */
      offeredPlayerIds: v.array(v.id("players")),
      /** Cash paid by the bidder, in euros. */
      cash: v.number(),
      message: v.optional(v.string()),
      status: offerStatusValidator,
      /** Counter-offer chain. */
      parentOfferId: v.optional(v.id("offers")),
      /** Last rule validation stored with the operation for auditability. */
      lastValidation: v.optional(v.string()),
      invalidReason: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      agreedAt: v.optional(v.number()),
      executedAt: v.optional(v.number()),
    })
      .index("by_tournament", ["tournamentId"])
      .index("by_bidder", ["bidderPresidentId"])
      .index("by_seller", ["sellerPresidentId"]),

    /* ----------------------------------------------------------------
     * Draft: turn order, per-turn clock and the picks themselves
     * ---------------------------------------------------------------- */

    drafts: defineTable({
      tournamentId: v.id("tournaments"),
      status: draftStatusValidator,
      /** Turn order: President ids, in the sequence they pick. */
      order: v.array(v.id("presidents")),
      currentIndex: v.number(),
      round: v.number(),
      totalRounds: v.number(),
      /** Seconds each President has per turn. 0 disables the automatic clock. */
      pickSeconds: v.number(),
      currentDeadline: v.optional(v.number()),
      /** Whether each round runs in the same order or reversed (snake draft). */
      snake: v.boolean(),
      /** Reserved agreements executed when the draft opened. */
      executedReserved: v.optional(v.number()),
      invalidatedReserved: v.optional(v.number()),
      startedAt: v.optional(v.number()),
      closedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_tournament", ["tournamentId"]),

    /* ----------------------------------------------------------------
     * Competition: calendar, results and standings source of truth
     * ---------------------------------------------------------------- */

    /**
     * The XI is snapshotted into the fixture at lock time, so a later transfer
     * never rewrites history: results stay auditable.
     */
    fixtures: defineTable({
      tournamentId: v.id("tournaments"),
      matchday: v.number(),
      homeClubId: v.id("clubs"),
      awayClubId: v.id("clubs"),
      status: fixtureStatusValidator,
      kickoffAt: v.number(),
      homeGoals: v.optional(v.number()),
      awayGoals: v.optional(v.number()),
      homePoints: v.optional(v.number()),
      awayPoints: v.optional(v.number()),
      homeXiOvr: v.optional(v.number()),
      awayXiOvr: v.optional(v.number()),
      playedAt: v.optional(v.number()),
    })
      .index("by_tournament", ["tournamentId"])
      .index("by_tournament_matchday", ["tournamentId", "matchday"])
      .index("by_home_club", ["homeClubId"])
      .index("by_away_club", ["awayClubId"]),

    draftPicks: defineTable({
      tournamentId: v.id("tournaments"),
      draftId: v.id("drafts"),
      presidentId: v.id("presidents"),
      clubId: v.id("clubs"),
      playerId: v.id("players"),
      price: v.number(),
      round: v.number(),
      pickNumber: v.number(),
      mode: draftPickModeValidator,
      pickedAt: v.number(),
    })
      .index("by_tournament", ["tournamentId"])
      .index("by_draft", ["draftId"])
      .index("by_player", ["playerId"])
      .index("by_president", ["presidentId"]),

    /* ----------------------------------------------------------------
     * Audit trail — every critical operation leaves a trace
     * ---------------------------------------------------------------- */

    auditLog: defineTable({
      tournamentId: v.id("tournaments"),
      clubId: v.optional(v.id("clubs")),
      actorUserId: v.optional(v.id("users")),
      actorName: v.string(),
      action: v.string(),
      entity: v.string(),
      entityId: v.optional(v.string()),
      detail: v.string(),
      createdAt: v.number(),
    })
      .index("by_tournament", ["tournamentId"])
      .index("by_club", ["clubId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
