import type { Id } from "./_generated/dataModel";
import type { OfferStatus, OfferType } from "./marketEngine";
import type {
  Lineup,
  LineupEvaluation,
  PlayerAvailability,
  Position,
  PositionGroup,
  RuleCheck,
  SquadEvaluation,
  SquadPlayerView,
  SquadStats,
  TournamentRules,
  TournamentStatus,
} from "./rulesEngine";

export type ClubView = {
  id: Id<"clubs">;
  name: string;
  shortName: string;
  league: string;
  country: string;
  colorPrimary: string;
  colorSecondary: string;
  rosterSize: number;
  averageOvr: number;
  totalValue: number;
  presidentNickname: string | null;
  presidentName: string | null;
};

export type TournamentView = {
  id: Id<"tournaments">;
  code: string;
  name: string;
  season: string;
  status: TournamentStatus;
  statusLabel: string;
  statusHint: string;
  currentMatchday: number;
  totalMatchdays: number;
  marketOpen: boolean;
  nextMatchdayAt: number | null;
};

export type PresidentView = {
  id: Id<"presidents">;
  userId: Id<"users">;
  nickname: string;
  displayName: string;
  email: string;
  clubId: Id<"clubs">;
  clubName: string;
  clubShortName: string;
  clubColors: [string, string];
  budget: number;
  joinedAt: number;
  isAdmin: boolean;
  adminRole: "principal" | "coAdmin" | null;
  squadSize: number;
};

export type AdminView = {
  id: Id<"tournamentAdmins">;
  userId: Id<"users">;
  displayName: string;
  email: string;
  role: "principal" | "coAdmin";
  permissions: string[];
  createdAt: number;
};

export type AuditEntryView = {
  id: Id<"auditLog">;
  action: string;
  actorName: string;
  detail: string;
  entity: string;
  clubName: string | null;
  createdAt: number;
};

export type NextEventView = {
  matchday: number;
  kickoffAt: number;
  lockAt: number;
  locked: boolean;
  rivalName: string | null;
  rivalShortName: string | null;
  rivalColors: [string, string] | null;
};

export type BudgetView = {
  initial: number;
  committed: number;
  available: number;
};

export type AdminOverviewView = {
  tournament: TournamentView | null;
  rules: TournamentRules | null;
  presidents: PresidentView[];
  admins: AdminView[];
  clubs: ClubView[];
  activity: AuditEntryView[];
  market: {
    reserved: OfferView[];
    recent: OfferView[];
    pending: number;
    open: boolean;
  };
  totals: {
    squads: number;
    players: number;
    committedBudget: number;
    freeClubs: number;
  };
};

/* ------------------------------------------------------------------ *
 * Market
 * ------------------------------------------------------------------ */

export type MarketPlayerView = {
  playerId: Id<"players">;
  name: string;
  position: Position;
  group: PositionGroup;
  ovr: number;
  age: number;
  value: number;
  nationality: string;
  flag: string;
  realClub: string;
  realLeague: string;
  fcVersion: string;
  /** Where the player comes from right now. */
  kind: "libre" | "club";
  ownerClubId: Id<"clubs"> | null;
  ownerClubName: string | null;
  ownerShortName: string | null;
  ownerColors: [string, string] | null;
  ownerNickname: string | null;
  ownerPresidentId: Id<"presidents"> | null;
  ownerIsMe: boolean;
  /** "libre" for free agents, otherwise the owner's availability flag. */
  availability: PlayerAvailability | "libre";
  offerable: boolean;
  blockedReason: string | null;
  /** Operation that already holds this player (commitment). */
  committedOfferId: Id<"offers"> | null;
  withinBudget: boolean;
  /** Cost of signing a free agent (their valuation). */
  minimumCash: number;
};

export type OfferPlayerLite = {
  playerId: Id<"players">;
  name: string;
  position: Position;
  group: PositionGroup;
  ovr: number;
  age: number;
  value: number;
  flag: string;
  clubName: string | null;
};

export type OfferView = {
  id: Id<"offers">;
  type: OfferType;
  status: OfferStatus;
  cash: number;
  message: string | null;
  createdAt: number;
  updatedAt: number;
  agreedAt: number | null;
  executedAt: number | null;
  /** Which side the current President is on. */
  side: "enviada" | "recibida" | "sistema";
  bidderNickname: string;
  bidderClubName: string;
  bidderClubColors: [string, string];
  bidderIsMe: boolean;
  sellerNickname: string | null;
  sellerClubName: string | null;
  sellerClubColors: [string, string] | null;
  requested: OfferPlayerLite[];
  offered: OfferPlayerLite[];
  canRespond: boolean;
  canCancel: boolean;
  /** Why a reserved operation cannot execute right now. */
  blockers: string[];
  invalidReason: string | null;
};

export type MarketSummaryView = {
  open: boolean;
  freeAgents: number;
  received: number;
  sent: number;
  reserved: number;
  executed: number;
  committedCash: number;
};

export type MarketOverviewView = {
  summary: MarketSummaryView;
  budget: BudgetView;
  received: OfferView[];
  sent: OfferView[];
  reserved: OfferView[];
  history: OfferView[];
};

export type MyAction = {
  id: string;
  tone: "warning" | "info" | "positive" | "danger";
  title: string;
  description: string;
  action: { label: string; to: string };
};

export type AppStateView = {
  needsClub: boolean;
  user: { id: Id<"users">; name: string; email: string; nickname: string };
  tournament: TournamentView | null;
  rules: TournamentRules | null;
  president: PresidentView | null;
  club: ClubView | null;
  clubs: ClubView[];
  squad: SquadPlayerView[];
  stats: SquadStats | null;
  evaluation: SquadEvaluation | null;
  lineup: Lineup | null;
  lineupEvaluation: LineupEvaluation | null;
  budget: BudgetView;
  availability: Record<PlayerAvailability, number>;
  nextEvent: NextEventView | null;
  isAdmin: boolean;
  adminRole: "principal" | "coAdmin" | null;
  market: MarketSummaryView;
  actions: MyAction[];
  activity: AuditEntryView[];
};

export type { RuleCheck };
