import type { Id } from "./_generated/dataModel";
import type { OfferStatus, OfferType } from "./marketEngine";
import type { StandingRow } from "./competitionEngine";
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
  /** teamCatalog entry this club was instantiated from (SoFIFA team). */
  catalogTeamId: Id<"teamCatalog"> | null;
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
  draft: DraftAdminView;
  competition: CompetitionSummaryView;
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

/* ------------------------------------------------------------------ *
 * Draft
 * ------------------------------------------------------------------ */

export type DraftPoolPlayerView = {
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
  /** What the pick costs: the snapshot valuation. */
  price: number;
  offerable: boolean;
  blockedReason: string | null;
};

export type DraftTurnView = {
  presidentId: Id<"presidents">;
  nickname: string;
  clubName: string;
  clubShortName: string;
  clubColors: [string, string];
  isMe: boolean;
  isCurrent: boolean;
  picks: number;
  spent: number;
  squadSize: number;
  budget: number;
};

export type DraftPickView = {
  id: Id<"draftPicks">;
  pickNumber: number;
  round: number;
  playerId: Id<"players">;
  playerName: string;
  position: Position;
  group: PositionGroup;
  ovr: number;
  age: number;
  flag: string;
  realClub: string;
  price: number;
  presidentId: Id<"presidents">;
  nickname: string;
  clubName: string;
  clubShortName: string;
  clubColors: [string, string];
  mode: "turno" | "reserva";
  pickedAt: number;
};

export type DraftSummaryView = {
  id: Id<"drafts"> | null;
  status: "borrador" | "en_curso" | "pausado" | "cerrado" | null;
  statusLabel: string;
  statusHint: string;
  round: number;
  totalRounds: number;
  pickSeconds: number;
  currentDeadline: number | null;
  /** Whose turn it is right now. */
  currentPresidentId: Id<"presidents"> | null;
  currentNickname: string | null;
  currentClubName: string | null;
  currentClubColors: [string, string] | null;
  isMyTurn: boolean;
  /** My seat in the turn order (1-based), 0 when I am not in it. */
  myPosition: number;
  orderSize: number;
  poolSize: number;
  myPicks: number;
  totalPicks: number;
  myBudget: number;
  squadSize: number;
  squadSizeLimit: number;
  executedReserved: number;
  invalidatedReserved: number;
};

export type DraftAdminView = {
  status: "borrador" | "en_curso" | "pausado" | "cerrado" | null;
  statusLabel: string;
  statusHint: string;
  round: number;
  totalRounds: number;
  pickSeconds: number;
  snake: boolean;
  currentDeadline: number | null;
  currentPresidentId: Id<"presidents"> | null;
  currentNickname: string | null;
  currentClubName: string | null;
  orderSize: number;
  totalSteps: number;
  totalPicks: number;
  poolSize: number;
  reservedPending: number;
  executedReserved: number;
  invalidatedReserved: number;
  turnOrder: DraftTurnView[];
  picks: DraftPickView[];
  /** Presidents who joined after the order was drawn. */
  unsignedPresidents: string[];
};

export type DraftControlView = {
  summary: DraftSummaryView;
  turnOrder: DraftTurnView[];
  picks: DraftPickView[];
  /** Reserved agreements still waiting for the draft window. */
  reservedPending: number;
};

/* ------------------------------------------------------------------ *
 * Equipos (club directory → squad → compare)
 * ------------------------------------------------------------------ */

export type TeamXISlot = {
  slotId: string;
  playerId: Id<"players">;
  name: string;
  position: Position;
  group: PositionGroup;
  ovr: number;
  flag: string;
};

/** Public squad view of any club, used by the Equipos section. */
export type TeamSquadView = {
  clubId: Id<"clubs">;
  clubName: string;
  clubShortName: string;
  clubColors: [string, string];
  squad: SquadPlayerView[];
  stats: SquadStats;
  formation: string;
  xiOvr: number;
  xi: TeamXISlot[];
};

export type MyAction = {
  id: string;
  tone: "warning" | "info" | "positive" | "danger";
  title: string;
  description: string;
  action: { label: string; to: string };
};

/* ------------------------------------------------------------------ *
 * Competition (calendar, results, standings)
 * ------------------------------------------------------------------ */

export type FixtureSideView = {
  clubId: Id<"clubs">;
  name: string;
  shortName: string;
  colors: [string, string];
};

export type FixtureView = {
  id: Id<"fixtures">;
  matchday: number;
  status: "programado" | "en_curso" | "jugado";
  kickoffAt: number;
  home: FixtureSideView;
  away: FixtureSideView;
  homeGoals: number | null;
  awayGoals: number | null;
  homePoints: number | null;
  awayPoints: number | null;
  homeXiOvr: number | null;
  awayXiOvr: number | null;
};

export type MatchdayGroupView = {
  matchday: number;
  status: "futura" | "en_curso" | "jugada";
  statusLabel: string;
  kickoffAt: number | null;
  playedCount: number;
  fixtures: FixtureView[];
};

export type MyMatchView = {
  matchday: number;
  status: "futura" | "en_curso" | "jugada";
  fixture: FixtureView;
  mySide: "home" | "away";
  myPoints: number | null;
  rivalPoints: number | null;
  myXiOvr: number | null;
  rivalNickname: string | null;
};

export type StandingRowView = StandingRow & { position: number };

export type CompetitionSummaryView = {
  /** False when the calendar has not been generated yet. */
  available: boolean;
  currentMatchday: number;
  totalMatchdays: number;
  calendarMatchdays: number;
  playedCount: number;
  totalCount: number;
  standings: StandingRowView[];
  matchdays: MatchdayGroupView[];
  /** My fixture in the current (or next) matchday. */
  myMatch: MyMatchView | null;
  /** My most recent played fixture. */
  previousMatch: MyMatchView | null;
  leader: StandingRowView | null;
};

export type CompetitionCalendarView = {
  tournament: TournamentView;
  summary: CompetitionSummaryView;
};

/* ------------------------------------------------------------------ *
 * Multi-league
 * ------------------------------------------------------------------ */

/** A league the user belongs to (created, joined or administrated). */
export type LeagueSummaryView = {
  id: Id<"tournaments">;
  code: string;
  name: string;
  season: string;
  memberCount: number;
  isAdmin: boolean;
  myClubName: string | null;
  active: boolean;
  createdAt: number;
};

/**
 * The signed-in state of a user without an active league: the control room is
 * replaced by the create/join gate until they pick or start one.
 */
export type NeedsLeagueState = {
  needsLeague: true;
  user: { id: Id<"users">; name: string; email: string; nickname: string };
  leagues: LeagueSummaryView[];
};

export type AppStateView = {
  needsClub: boolean;
  /** Always false in the full app state (see NeedsLeagueState). */
  needsLeague: false;
  /** Every league the user belongs to, active one first. */
  leagues: LeagueSummaryView[];
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
  draft: DraftSummaryView | null;
  competition: CompetitionSummaryView;
  actions: MyAction[];
  activity: AuditEntryView[];
};

export type { RuleCheck };
