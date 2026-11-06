export type RecordedStat = {
  teamId: string;
  player: string;
  count: number;
  ownGoal?: boolean;
};
export type RecordedMatch = {
  id: string;
  round: number | null;
  stage: string;
  homeId: string;
  awayId: string;
  home: string;
  away: string;
  homeGoals: number | null;
  awayGoals: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  videoId: string;
  evidenceSecond: number;
  verified: boolean;
  version: number;
  goals: RecordedStat[] | null;
  assists: RecordedStat[] | null;
  yellowCards: RecordedStat[] | null;
  redCards: RecordedStat[] | null;
};
export type RecordedCompetition = {
  id: string;
  slug: string;
  name: string;
  format: "league" | "cup" | "league_playoffs";
  season: string;
  reviewFrom: number | null;
  latestRound: number | null;
  videoCount: number;
  verifiedMatches: number;
  standings: {
    team: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
  }[];
  matches: RecordedMatch[];
  players: {
    team: string;
    name: string;
    goals: number | null;
    assists: number | null;
    yellowCards: number | null;
    redCards: number | null;
  }[];
};
