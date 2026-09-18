/**
 * Competition engine — pure functions, no Convex imports.
 *
 * The calendar is a double round-robin over the tournament clubs (circle
 * method). Scoring is DETERMINISTIC per fixture: the same pair of squads on the
 * same matchday always produces the same result, derived from a hash of the
 * match identity and the fantasy strength of each XI. There is no randomness
 * and nothing to seed: an operation that is auditable must be reproducible.
 *
 * Per prompt §25-26 thePresident sees: puntos fantasy, marcador, tabla with
 * PJ/G/E/P, GF/GC/DIF, plus valor/OVR context in the Match Center.
 */

/* ------------------------------------------------------------------ *
 * Fixture generation (circle method, double round)
 * ------------------------------------------------------------------ */

export type FixtureSeed = {
  matchday: number;
  homeClubId: string;
  awayClubId: string;
};

/**
 * Double round-robin: every club plays every other home and away. With N clubs
 * the calendar has 2·(N−1) matchdays (8 clubs → 14 jornadas).
 */
export function buildCalendar(clubIds: string[]): FixtureSeed[] {
  const teams = [...clubIds];
  if (teams.length < 2) return [];
  if (teams.length % 2 === 1) teams.push("__BYE__");

  const n = teams.length;
  const half = n / 2;
  const rounds = n - 1;
  const fixtures: FixtureSeed[] = [];

  const left = teams.slice(0, half);
  const right = teams.slice(half).reverse();

  for (let round = 0; round < rounds; round += 1) {
    const matchday = round + 1;
    for (let i = 0; i < half; i += 1) {
      const a = left[i];
      const b = right[i];
      if (a === "__BYE__" || b === "__BYE__") continue;
      // Alternate the venue so the return leg flips home/away.
      const homeFirst = (round + i) % 2 === 0;
      fixtures.push({
        matchday,
        homeClubId: homeFirst ? a : b,
        awayClubId: homeFirst ? b : a,
      });
      fixtures.push({
        matchday: matchday + rounds,
        homeClubId: homeFirst ? b : a,
        awayClubId: homeFirst ? a : b,
      });
    }
    // Rotate all but the first team (circle method).
    const fixed = left[0];
    const restLeft = left.slice(1);
    restLeft.unshift(right.shift() ?? "__BYE__");
    right.push(restLeft.pop() ?? "__BYE__");
    left.splice(1, left.length - 1, ...restLeft);
    void fixed;
  }

  return fixtures.sort((a, b) => a.matchday - b.matchday);
}

/* ------------------------------------------------------------------ *
 * Deterministic scoring
 * ------------------------------------------------------------------ */

/** FNV-1a over a string: stable across deploys and replays. */
export function hashSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Fantasy points of a side in a fixture: strength-driven with a small
 * deterministic variance so matchdays differ without hiding the better XI.
 */
export function fantasyPointsForSide(params: {
  matchKey: string;
  clubId: string;
  xiOvr: number;
}): number {
  const { matchKey, clubId, xiOvr } = params;
  if (xiOvr <= 0) return 0;
  const variance = (hashSeed(`${matchKey}:${clubId}`) % 21) - 10; // −10..+10
  const base = xiOvr * 0.85 + 6; // ~78 for an 84 XI
  return Math.max(30, Math.round(base + variance));
}

export function goalsForPoints(params: {
  matchKey: string;
  clubId: string;
  points: number;
  pointDiff: number;
}): number {
  const { matchKey, clubId, points, pointDiff } = params;
  const roll = hashSeed(`${matchKey}:${clubId}:goals`) % 4; // 0..3
  let goals = Math.max(0, Math.round((points - 70) / 5) + roll);
  if (pointDiff >= 10) goals += 1;
  if (pointDiff <= -12) goals = Math.max(0, goals - 1);
  return Math.min(6, goals);
}

export type FixtureOutcome = {
  homePoints: number;
  awayPoints: number;
  homeGoals: number;
  awayGoals: number;
};

export function resolveFixture(params: {
  matchKey: string;
  homeXiOvr: number;
  awayXiOvr: number;
}): FixtureOutcome {
  const { matchKey, homeXiOvr, awayXiOvr } = params;
  const homePoints = fantasyPointsForSide({
    matchKey,
    clubId: "home",
    xiOvr: homeXiOvr,
  });
  const awayPoints = fantasyPointsForSide({
    matchKey,
    clubId: "away",
    xiOvr: awayXiOvr,
  });
  const homeGoals = goalsForPoints({
    matchKey,
    clubId: "home",
    points: homePoints,
    pointDiff: homePoints - awayPoints,
  });
  const awayGoals = goalsForPoints({
    matchKey,
    clubId: "away",
    points: awayPoints,
    pointDiff: awayPoints - homePoints,
  });
  return { homePoints, awayPoints, homeGoals, awayGoals };
}

/* ------------------------------------------------------------------ *
 * Standings
 * ------------------------------------------------------------------ */

export type StandingRow = {
  clubId: string;
  clubName: string;
  clubShortName: string;
  clubColors: [string, string];
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  fantasyFor: number;
  fantasyAgainst: number;
};

export type ScoredFixture = {
  homeClubId: string;
  awayClubId: string;
  homeGoals: number;
  awayGoals: number;
  homePoints: number;
  awayPoints: number;
  played: boolean;
};

export function computeStandings(
  rows: Array<{
    clubId: string;
    clubName: string;
    clubShortName: string;
    clubColors: [string, string];
  }>,
  fixtures: ScoredFixture[],
): StandingRow[] {
  const table = new Map<string, StandingRow>();
  for (const club of rows) {
    table.set(club.clubId, {
      ...club,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
      fantasyFor: 0,
      fantasyAgainst: 0,
    });
  }

  for (const fixture of fixtures) {
    if (!fixture.played) continue;
    const home = table.get(fixture.homeClubId);
    const away = table.get(fixture.awayClubId);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += fixture.homeGoals;
    home.goalsAgainst += fixture.awayGoals;
    away.goalsFor += fixture.awayGoals;
    away.goalsAgainst += fixture.homeGoals;
    home.fantasyFor += fixture.homePoints;
    home.fantasyAgainst += fixture.awayPoints;
    away.fantasyFor += fixture.awayPoints;
    away.fantasyAgainst += fixture.homePoints;

    if (fixture.homeGoals > fixture.awayGoals) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (fixture.homeGoals < fixture.awayGoals) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  const list = [...table.values()];
  for (const row of list) row.goalDiff = row.goalsFor - row.goalsAgainst;

  return list.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      b.fantasyFor - a.fantasyFor ||
      a.clubName.localeCompare(b.clubName),
  );
}

/* ------------------------------------------------------------------ *
 * Matchday lifecycle
 * ------------------------------------------------------------------ */

export type MatchdayStatus = "futura" | "en_curso" | "jugada";

export function matchdayStatusOf(params: {
  matchday: number;
  currentMatchday: number;
  allPlayed: boolean;
}): MatchdayStatus {
  if (params.matchday < params.currentMatchday) return "jugada";
  if (params.matchday > params.currentMatchday) return "futura";
  return params.allPlayed ? "jugada" : "en_curso";
}

export const MATCHDAY_STATUS_LABEL: Record<MatchdayStatus, string> = {
  futura: "Próxima",
  en_curso: "En curso",
  jugada: "Jugada",
};

/** Kickoff anchor: nextMatchdayAt is jornada N's kickoff; others are ±weeks. */
export function kickoffForMatchday(params: {
  matchday: number;
  currentMatchday: number;
  anchor: number;
}): number {
  return (
    params.anchor +
    (params.matchday - params.currentMatchday) * 7 * 24 * 60 * 60 * 1000
  );
}
