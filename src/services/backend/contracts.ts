/** Client view contracts, independent of generated Convex server types. */
import type {
  AdminOverviewView, AppStateView, NeedsLeagueState, MarketOverviewView,
  MarketPlayerView, DraftControlView, DraftPoolPlayerView, TeamSquadView,
  FixtureReportView,
} from "@/domain/appTypes";
import type { RuleCheck } from "@/domain/rulesEngine";
import type { ApiRef } from "./api";

type Evaluation = {
  passed: boolean;
  checks: RuleCheck[];
  blockers: string[];
  spendable: number;
  guidance: { maxOffer: number; suggested: number; walkAway: number };
  sellerClubName: string | null;
};

type ReadResults = {
  "users.currentUser": Record<string, unknown> | null;
  "tournament.state": AppStateView | NeedsLeagueState | null;
  "tournament.adminOverview": AdminOverviewView | null;
  "market.browse": { players: MarketPlayerView[]; total: number };
  "market.overview": MarketOverviewView | null;
  "market.validateOffer": Evaluation | null;
  "market.guidance": Evaluation | null;
  "draft.control": DraftControlView | null;
  "draft.check": Evaluation & { isMyTurn: boolean; unavailableReason: string | null };
  "draft.pool": DraftPoolPlayerView[];
  "teams.squadOf": TeamSquadView | null;
  "adminOps.fixtureReport": FixtureReportView | null;
  "footballSync.catalogState": {
    total: number; freeAgents: number; owned: number; version: string;
    lastError: { message: string; at: number } | null;
    lastSync: { at: number; source: string; inserted: number; updated: number; fetched: number; unchanged: number } | null;
  };
};

type MutationResults = {
  "leagues.createLeague": { id: string; name: string };
  "leagues.joinLeague": { id: string; name: string };
  "leagues.activateLeague": { name: string };
  "market.createOffer": { status: string; message: string };
  "competition.syncCompetition": { seeded: number; activated: number };
  "competition.closeMatchday": { closedMatchday: number; played: number; nextMatchday: number | null };
  "tournament.ensureTeamCatalog": { inserted: number };
  "tournament.grantAdmin": { granted: number };
  "adminOps.setCompetition": { name: string; matchdays: number };
  "adminOps.resetLeague": { counts: { presidents: number; squads: number; fixtures: number } };
  "adminOps.setPrizes": { configured: number; total: number };
  "adminOps.changePresidentClub": { clubName: string };
  "adminOps.grantBudget": { granted: number; budget: number };
  "adminOps.reportFixture": { homeGoals: number; awayGoals: number; injured: number };
  "footballApi.syncCatalog": {
    fetched: number; inserted: number; updated: number; unchanged: number;
    done: boolean; page: number; totalPages: number; fallback: boolean; note: string | null;
  };
};

export type ReadResult<R extends ApiRef> = R["__ref"] extends keyof ReadResults ? ReadResults[R["__ref"]] : unknown;
type RefName<R extends ApiRef | string> = R extends ApiRef ? R["__ref"] : R;
export type MutationResult<R extends ApiRef | string> = RefName<R> extends keyof MutationResults ? MutationResults[RefName<R>] : unknown;
