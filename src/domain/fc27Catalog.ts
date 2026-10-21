/**
 * EA SPORTS FC™ 27 — official competition catalogue.
 *
 * Source: EA's "Unrivalled Authenticity — Leagues & Licenses in EA SPORTS
 * FC™ 27" (ea.com/games/ea-sports-fc/fc-27/news/fc-27-authenticity).
 *
 * 11Eleven ONLY creates/configures tournaments from this list, so the game and
 * EA SPORTS FC 27 always stay in parity: if a competition does not exist in
 * FC 27, it cannot exist here.
 */

export type Fc27Kind = "liga" | "copa" | "internacional";

export type Fc27Competition = {
  /** Stable id stored in `tournaments.competitionId`. */
  id: string;
  /** Competition name exactly as EA presents it. */
  name: string;
  country: string;
  kind: Fc27Kind;
  /** Clubs in the competition (when EA publishes the figure). */
  teams?: number;
  /** Women's competition. */
  women?: boolean;
  /** Short note shown in the picker. */
  note?: string;
};

export const FC27_COMPETITIONS: Fc27Competition[] = [
  /* ----------------------------------------------------------- *
   * International / continental
   * ----------------------------------------------------------- */
  { id: "uefa-ucl", name: "UEFA Champions League", country: "Europa (UEFA)", kind: "internacional", note: "Máxima competición europea de clubes" },
  { id: "uefa-uel", name: "UEFA Europa League", country: "Europa (UEFA)", kind: "internacional" },
  { id: "uefa-uecl", name: "UEFA Conference League", country: "Europa (UEFA)", kind: "internacional" },
  { id: "uefa-super-cup", name: "UEFA Super Cup", country: "Europa (UEFA)", kind: "internacional" },
  { id: "uefa-wucl", name: "UEFA Women's Champions League", country: "Europa (UEFA)", kind: "internacional", women: true },
  { id: "conmebol-libertadores", name: "CONMEBOL Libertadores", country: "Sudamérica (CONMEBOL)", kind: "internacional" },
  { id: "conmebol-sudamericana", name: "CONMEBOL Sudamericana", country: "Sudamérica (CONMEBOL)", kind: "internacional" },
  { id: "conmebol-recopa", name: "CONMEBOL Recopa", country: "Sudamérica (CONMEBOL)", kind: "internacional" },

  /* ----------------------------------------------------------- *
   * England
   * ----------------------------------------------------------- */
  { id: "eng-premier-league", name: "Premier League", country: "Inglaterra", kind: "liga", teams: 20 },
  { id: "eng-championship", name: "EFL Championship", country: "Inglaterra", kind: "liga", teams: 24 },
  { id: "eng-league-one", name: "EFL League One", country: "Inglaterra", kind: "liga", teams: 24 },
  { id: "eng-league-two", name: "EFL League Two", country: "Inglaterra", kind: "liga", teams: 24 },
  { id: "eng-carabao-cup", name: "Carabao Cup", country: "Inglaterra", kind: "copa" },
  { id: "eng-wsl", name: "Barclays Women's Super League", country: "Inglaterra", kind: "liga", teams: 14, women: true },

  /* ----------------------------------------------------------- *
   * Spain
   * ----------------------------------------------------------- */
  { id: "esp-laliga", name: "LALIGA EA SPORTS", country: "España", kind: "liga", teams: 20 },
  { id: "esp-laliga-hypermotion", name: "LALIGA HYPERMOTION", country: "España", kind: "liga", teams: 20, note: "Segunda división" },
  { id: "esp-liga-f", name: "Liga F Moeve", country: "España", kind: "liga", teams: 16, women: true },

  /* ----------------------------------------------------------- *
   * Germany
   * ----------------------------------------------------------- */
  { id: "ger-bundesliga", name: "Bundesliga", country: "Alemania", kind: "liga", teams: 18 },
  { id: "ger-frauen-bundesliga", name: "Google Pixel Frauen-Bundesliga", country: "Alemania", kind: "liga", teams: 14, women: true },
  { id: "ger-3-liga", name: "3. Liga", country: "Alemania", kind: "liga", teams: 20, note: "Tercera división" },

  /* ----------------------------------------------------------- *
   * France & Italy
   * ----------------------------------------------------------- */
  { id: "fra-ligue1", name: "Ligue 1 McDonald's", country: "Francia", kind: "liga", teams: 18 },
  { id: "fra-arkema", name: "Arkema Première Ligue", country: "Francia", kind: "liga", teams: 12, women: true },
  { id: "ita-serie-a", name: "Serie A Enilive", country: "Italia", kind: "liga", teams: 20 },

  /* ----------------------------------------------------------- *
   * Rest of the world (EA "& More" list)
   * ----------------------------------------------------------- */
  { id: "mex-liga-mx", name: "Liga BBVA MX", country: "México", kind: "liga", teams: 18, note: "Nueva en FC 27" },
  { id: "usa-mls", name: "Major League Soccer", country: "Estados Unidos", kind: "liga", teams: 30 },
  { id: "usa-nwsl", name: "National Women's Soccer League", country: "Estados Unidos", kind: "liga", teams: 16, women: true },
  { id: "tur-super-lig", name: "Trendyol Süper Lig", country: "Turquía", kind: "liga", teams: 18 },
  { id: "por-liga-portugal", name: "Liga Portugal", country: "Portugal", kind: "liga", teams: 18 },
  { id: "bel-pro-league", name: "Belgium Pro League", country: "Bélgica", kind: "liga", teams: 16 },
  { id: "ned-eredivisie", name: "Eredivisie", country: "Países Bajos", kind: "liga", teams: 18 },
  { id: "arg-liga-profesional", name: "Liga Profesional de Fútbol", country: "Argentina", kind: "liga" },
  { id: "ksa-roshn-saudi-league", name: "Roshn Saudi League", country: "Arabia Saudí", kind: "liga", teams: 18 },
  { id: "kor-k-league", name: "K League", country: "Corea del Sur", kind: "liga" },
  { id: "chn-chinese-super-league", name: "Chinese Super League", country: "China", kind: "liga" },
  { id: "aus-a-league", name: "A-League", country: "Australia", kind: "liga" },
  { id: "pol-ekstraklasa", name: "Ekstraklasa", country: "Polonia", kind: "liga" },
  { id: "aut-bundesliga", name: "Austrian Bundesliga", country: "Austria", kind: "liga" },
  { id: "sui-super-league", name: "Super League", country: "Suiza", kind: "liga" },
  { id: "dnk-superliga", name: "Superliga", country: "Dinamarca", kind: "liga" },
  { id: "sco-premiership", name: "Scottish Premiership", country: "Escocia", kind: "liga" },
  { id: "irl-premier-division", name: "SSE Airtricity League Premier Division", country: "Irlanda", kind: "liga" },
  { id: "swe-allsvenskan", name: "Allsvenskan", country: "Suecia", kind: "liga" },
  { id: "nor-eliteserien", name: "Eliteserien", country: "Noruega", kind: "liga" },
];

const BY_ID = new Map(FC27_COMPETITIONS.map((competition) => [competition.id, competition]));

/** The default competition when none is chosen yet (parity with FC 27). */
export const DEFAULT_FC27_ID = "eng-premier-league";

export function fc27Competition(id: string | null | undefined): Fc27Competition | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

export function isValidFc27Id(id: string): boolean {
  return BY_ID.has(id);
}

/**
 * Matchdays a 11Eleven league mirroring this competition plays: double
 * round-robin (ida y vuelta) for domestic leagues, a short group stage for
 * cups/international tournaments.
 */
export function fc27Matchdays(competition: Fc27Competition): number {
  if (competition.kind === "liga" && competition.teams && competition.teams >= 2) {
    return (competition.teams - 1) * 2;
  }
  if (competition.kind === "copa") return 7;
  if (competition.kind === "internacional") return 13;
  return 38;
}

export const FC27_KIND_LABEL: Record<Fc27Kind, string> = {
  liga: "Liga",
  copa: "Copa",
  internacional: "Internacional",
};
