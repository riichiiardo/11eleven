import type { Id } from "./_generated/dataModel";
import type {
  Lineup,
  LineupEvaluation,
  PlayerAvailability,
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
  totals: {
    squads: number;
    players: number;
    committedBudget: number;
    freeClubs: number;
  };
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
  actions: MyAction[];
  activity: AuditEntryView[];
};

export type { RuleCheck };
