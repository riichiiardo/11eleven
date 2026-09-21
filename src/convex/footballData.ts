/**
 * 11Eleven — player source snapshot.
 *
 * The platform never queries an external ratings page at runtime. EA publishes
 * the FC 27 ratings repository and SoFIFA exposes player / free-agent
 * endpoints; this module is the normalised, versioned import of that data.
 * Every record carries the snapshot it came from (`FC_VERSION`) so a
 * tournament always knows which database it is playing with.
 *
 * Player tuple: [nombre, posición, OVR, edad, valor(M€), nacionalidad, bandera]
 */

import { FC_VERSION, FREE_AGENT_CLUB, type Position } from "./rulesEngine";

export type PlayerSeed = [string, Position, number, number, number, string, string];

export const FREE_AGENT_LEAGUE = "Sin club";
export const FREE_AGENT_CLUB_NAME = FREE_AGENT_CLUB;

export type ClubSeed = {
  name: string;
  shortName: string;
  league: string;
  country: string;
  colors: [string, string];
  players: PlayerSeed[];
};

export const TOURNAMENT_SEED = {
  name: "Liga 11Eleven Foundation",
  season: "2025 / 2026",
  currentMatchday: 12,
  totalMatchdays: 38,
} as const;

/** Helper to create a team entry with no players (draft fills squads). */
function team(
  name: string,
  shortName: string,
  league: string,
  country: string,
  colors: [string, string],
  players: PlayerSeed[] = [],
): ClubSeed {
  return { name, shortName, league, country, colors, players };
}

export const CLUBS: ClubSeed[] = [
  /* ================================================================ PREMIER LEAGUE */
  team("Manchester City", "MCI", "Premier League", "Inglaterra", ["#6CABDD", "#1C2C5B"]),
  team("Arsenal FC", "ARS", "Premier League", "Inglaterra", ["#EF0107", "#063672"]),
  team("Liverpool FC", "LIV", "Premier League", "Inglaterra", ["#C8102E", "#00B2A9"]),
  team("Aston Villa", "AVL", "Premier League", "Inglaterra", ["#670E36", "#95BFE5"]),
  team("Tottenham Hotspur", "TOT", "Premier League", "Inglaterra", ["#132257", "#FFFFFF"]),
  team("Chelsea FC", "CHE", "Premier League", "Inglaterra", ["#034694", "#DBA111"]),
  team("Newcastle United", "NEW", "Premier League", "Inglaterra", ["#241F20", "#FFFFFF"]),
  team("Manchester United", "MUN", "Premier League", "Inglaterra", ["#DA291C", "#FBE122"]),
  team("West Ham United", "WHU", "Premier League", "Inglaterra", ["#7A263A", "#1BB1E7"]),
  team("Brighton & Hove Albion", "BHA", "Premier League", "Inglaterra", ["#0057B8", "#FFFFFF"]),
  team("Wolverhampton", "WOL", "Premier League", "Inglaterra", ["#FDB913", "#231F20"]),
  team("Fulham FC", "FUL", "Premier League", "Inglaterra", ["#000000", "#FFFFFF"]),
  team("Bournemouth", "BOU", "Premier League", "Inglaterra", ["#DA291C", "#000000"]),
  team("Brentford FC", "BRE", "Premier League", "Inglaterra", ["#E30613", "#FFB81C"]),
  team("Crystal Palace", "CRY", "Premier League", "Inglaterra", ["#1B458F", "#C4122E"]),
  team("Nottingham Forest", "NFO", "Premier League", "Inglaterra", ["#DD0000", "#FFFFFF"]),
  team("Everton FC", "EVE", "Premier League", "Inglaterra", ["#003399", "#FFFFFF"]),
  team("Ipswich Town", "IPS", "Premier League", "Inglaterra", ["#0044AA", "#FFFFFF"]),
  team("Leicester City", "LEI", "Premier League", "Inglaterra", ["#003090", "#FFFFFF"]),
  team("Southampton FC", "SOU", "Premier League", "Inglaterra", ["#D71920", "#FFFFFF"]),

  /* ================================================================ LALIGA */
  team("Real Madrid CF", "RMA", "LaLiga", "España", ["#FEBE10", "#00529F"]),
  team("FC Barcelona", "BAR", "LaLiga", "España", ["#A50044", "#004D98"]),
  team("Atlético Madrid", "ATM", "LaLiga", "España", ["#CE3524", "#FFFFFF"]),
  team("Athletic Bilbao", "ATH", "LaLiga", "España", ["#EE2523", "#FFFFFF"]),
  team("Real Sociedad", "RSO", "LaLiga", "España", ["#003DA5", "#FFFFFF"]),
  team("Real Betis", "BET", "LaLiga", "España", ["#00954C", "#FFFFFF"]),
  team("Villarreal CF", "VIL", "LaLiga", "España", ["#FFE114", "#005B8E"]),
  team("Sevilla FC", "SEV", "LaLiga", "España", ["#D40D26", "#FFFFFF"]),
  team("Valencia CF", "VAL", "LaLiga", "España", ["#EE3524", "#000000"]),
  team("RC Celta", "CEL", "LaLiga", "España", ["#8AC3EE", "#FFFFFF"]),
  team("Getafe CF", "GET", "LaLiga", "España", ["#004FA3", "#FFFFFF"]),
  team("CA Osasuna", "OSA", "LaLiga", "España", ["#D91A21", "#003DA5"]),
  team("RCD Mallorca", "MLL", "LaLiga", "España", ["#E20613", "#000000"]),
  team("Rayo Vallecano", "RAY", "LaLiga", "España", ["#E53027", "#FFFFFF"]),
  team("UD Almería", "ALM", "LaLiga", "España", ["#E53027", "#FFFFFF"]),
  team("Las Palmas", "LPA", "LaLiga", "España", ["#FFD700", "#00529F"]),

  /* ================================================================ SERIE A */
  team("Inter de Milán", "INT", "Serie A", "Italia", ["#0068A8", "#0A0A0A"]),
  team("AC Milan", "MIL", "Serie A", "Italia", ["#FB090B", "#000000"]),
  team("Juventus FC", "JUV", "Serie A", "Italia", ["#000000", "#FFFFFF"]),
  team("SSC Napoli", "NAP", "Serie A", "Italia", ["#12A0D7", "#FFFFFF"]),
  team("AS Roma", "ROM", "Serie A", "Italia", ["#8E1F2F", "#F0BC42"]),
  team("SS Lazio", "LAZ", "Serie A", "Italia", ["#87D8F7", "#FFFFFF"]),
  team("Atalanta BC", "ATA", "Serie A", "Italia", ["#1E71B8", "#000000"]),
  team("ACF Fiorentina", "FIO", "Serie A", "Italia", ["#5B2C8A", "#FFFFFF"]),
  team("Torino FC", "TOR", "Serie A", "Italia", ["#8B0000", "#FFFFFF"]),
  team("Bologna FC", "BOL", "Serie A", "Italia", ["#1A2B5C", "#FFFFFF"]),
  team("US Lecce", "LEC", "Serie A", "Italia", ["#FFD700", "#000000"]),
  team("Genoa CFC", "GEN", "Serie A", "Italia", ["#8B0000", "#FFFFFF"]),
  team("Udinese Calcio", "UDI", "Serie A", "Italia", ["#000000", "#FFFFFF"]),
  team("Cagliari Calcio", "CAG", "Serie A", "Italia", ["#8B0000", "#0044AA"]),
  team("Hellas Verona", "VER", "Serie A", "Italia", ["#0044AA", "#FFD700"]),
  team("US Sassuolo", "SAS", "Serie A", "Italia", ["#00A850", "#000000"]),

  /* ================================================================ BUNDESLIGA */
  team("Bayern de Múnich", "BAY", "Bundesliga", "Alemania", ["#DC052D", "#0066B2"]),
  team("Borussia Dortmund", "BVB", "Bundesliga", "Alemania", ["#FDE100", "#000000"]),
  team("Bayer Leverkusen", "LEV", "Bundesliga", "Alemania", ["#E32221", "#000000"]),
  team("RB Leipzig", "RBL", "Bundesliga", "Alemania", ["#DD0741", "#FFFFFF"]),
  team("Eintracht Frankfurt", "SGE", "Bundesliga", "Alemania", ["#E1000F", "#000000"]),
  team("VfB Stuttgart", "STU", "Bundesliga", "Alemania", ["#E32219", "#FFFFFF"]),
  team("VfL Wolfsburg", "WOB", "Bundesliga", "Alemania", ["#65B32E", "#000000"]),
  team("SC Freiburg", "FRE", "Bundesliga", "Alemania", ["#000000", "#FFFFFF"]),
  team("Borussia Mönchengladbach", "BMG", "Bundesliga", "Alemania", ["#18A950", "#000000"]),
  team("Werder Bremen", "SVW", "Bundesliga", "Alemania", ["#1D9053", "#FFFFFF"]),

  /* ================================================================ LIGUE 1 */
  team("Paris Saint-Germain", "PSG", "Ligue 1", "Francia", ["#004170", "#DA291C"]),
  team("Olympique de Marsella", "OM", "Ligue 1", "Francia", ["#2FAEE0", "#FFFFFF"]),
  team("Olympique Lyonnais", "OL", "Ligue 1", "Francia", ["#004DA0", "#FFFFFF"]),
  team("AS Monaco", "MON", "Ligue 1", "Francia", ["#E7192D", "#FFFFFF"]),
  team("Lille OSC", "LIL", "Ligue 1", "Francia", ["#E3001B", "#FFFFFF"]),
  team("OGC Nice", "NIC", "Ligue 1", "Francia", ["#E30613", "#000000"]),
  team("Stade Rennais", "REN", "Ligue 1", "Francia", ["#E30613", "#000000"]),
  team("RC Lens", "RCL", "Ligue 1", "Francia", ["#FFD700", "#E30613"]),
  team("RC Strasbourg", "STR", "Ligue 1", "Francia", ["#009FE3", "#FFFFFF"]),
  team("Toulouse FC", "TOU", "Ligue 1", "Francia", ["#7B2D8B", "#FFFFFF"]),

  /* ================================================================ LIGA PORTUGUESA */
  team("FC Porto", "FPO", "Liga Portugal", "Portugal", ["#003893", "#FFFFFF"]),
  team("SL Benfica", "BEN", "Liga Portugal", "Portugal", ["#FF0000", "#FFFFFF"]),
  team("Sporting CP", "SCP", "Liga Portugal", "Portugal", ["#00843D", "#FFFFFF"]),
  team("SC Braga", "BRA", "Liga Portugal", "Portugal", ["#E30613", "#FFFFFF"]),

  /* ================================================================ EREDIVISIE */
  team("AFC Ajax", "AJX", "Eredivisie", "Países Bajos", ["#D2122E", "#FFFFFF"]),
  team("PSV Eindhoven", "PSV", "Eredivisie", "Países Bajos", ["#ED1C24", "#FFFFFF"]),
  team("Feyenoord Rotterdam", "FEY", "Eredivisie", "Países Bajos", ["#EE3124", "#FFFFFF"]),
  team("AZ Alkmaar", "AZ", "Eredivisie", "Países Bajos", ["#E30613", "#FFFFFF"]),

  /* ================================================================ SUPER LIGA TURCA */
  team("Galatasaray SK", "GAL", "Süper Lig", "Turquía", ["#FFD700", "#E30613"]),
  team("Fenerbahçe SK", "FNB", "Süper Lig", "Turquía", ["#002D87", "#FFD700"]),
  team("Beşiktaş JK", "BJK", "Süper Lig", "Turquía", ["#000000", "#FFFFFF"]),

  /* ================================================================ LIGA ARGENTINA */
  team("River Plate", "RIV", "Liga Profesional", "Argentina", ["#FFFFFF", "#E30613"]),
  team("Boca Juniors", "BOC", "Liga Profesional", "Argentina", ["#003DA5", "#FFD700"]),
  team("Racing Club", "RAC", "Liga Profesional", "Argentina", ["#6CB4EE", "#FFFFFF"]),
  team("San Lorenzo", "SLA", "Liga Profesional", "Argentina", ["#003DA5", "#E30613"]),
  team("Estudiantes LP", "EDLP", "Liga Profesional", "Argentina", ["#E30613", "#FFFFFF"]),
  team("Vélez Sarsfield", "VEL", "Liga Profesional", "Argentina", ["#FFFFFF", "#003DA5"]),

  /* ================================================================ BRASILEIRÃO */
  team("Flamengo", "FLA", "Brasileirão", "Brasil", ["#E30613", "#000000"]),
  team("Palmeiras", "PAL", "Brasileirão", "Brasil", ["#006437", "#FFFFFF"]),
  team("Corinthians", "COR", "Brasileirão", "Brasil", ["#000000", "#FFFFFF"]),
  team("São Paulo FC", "SPF", "Brasileirão", "Brasil", ["#E30613", "#000000"]),
  team("Santos FC", "SAN", "Brasileirão", "Brasil", ["#000000", "#FFFFFF"]),
  team("Internacional", "SGA", "Brasileirão", "Brasil", ["#E30613", "#FFFFFF"]),
  team("Grêmio", "GRE", "Brasileirão", "Brasil", ["#0068A8", "#FFFFFF"]),

  /* ================================================================ LIGA MX */
  team("Club América", "AME", "Liga MX", "México", ["#FFD700", "#004B8D"]),
  team("Chivas de Guadalajara", "GDL", "Liga MX", "México", ["#E30613", "#FFFFFF"]),
  team("Cruz Azul", "CAZ", "Liga MX", "México", ["#004B8D", "#FFFFFF"]),
  team("Tigres UANL", "TIG", "Liga MX", "México", ["#FFD700", "#004B8D"]),
  team("CF Monterrey", "MTY", "Liga MX", "México", ["#004B8D", "#FFFFFF"]),

  /* ================================================================ SAUDI PRO LEAGUE */
  team("Al-Hilal SFC", "HIL", "Saudi Pro League", "Arabia Saudita", ["#004B8D", "#FFFFFF"]),
  team("Al-Ahli SFC", "AHL", "Saudi Pro League", "Arabia Saudita", ["#006838", "#FFFFFF"]),
  team("Al-Nassr FC", "NAS", "Saudi Pro League", "Arabia Saudita", ["#FFD700", "#004B8D"]),
  team("Al-Ittihad Club", "ITT", "Saudi Pro League", "Arabia Saudita", ["#FFD700", "#000000"]),

  /* ================================================================ LIGA COLOMBIANA */
  team("Millonarios FC", "MIL", "Liga BetPlay", "Colombia", ["#004B8D", "#FFFFFF"]),
  team("Atlético Nacional", "NAC", "Liga BetPlay", "Colombia", ["#006838", "#FFFFFF"]),
  team("Independiente Santa Fe", "ISF", "Liga BetPlay", "Colombia", ["#E30613", "#FFFFFF"]),
  team("América de Cali", "ACAL", "Liga BetPlay", "Colombia", ["#E30613", "#FFFFFF"]),
  team("Junior FC", "JUN", "Liga BetPlay", "Colombia", ["#E30613", "#004B8D"]),

  /* ================================================================ MLS */
  team("Inter Miami CF", "MIA", "MLS", "Estados Unidos", ["#F5B6CD", "#000000"]),
  team("LA Galaxy", "LAG", "MLS", "Estados Unidos", ["#00245D", "#FFD700"]),
  team("New York City FC", "NYC", "MLS", "Estados Unidos", ["#6CACE4", "#00205B"]),

  /* ================================================================ J1 LEAGUE */
  team("Kawasaki Frontale", "KAW", "J1 League", "Japón", ["#003DA5", "#000000"]),
  team("Yokohama F. Marinos", "YFM", "J1 League", "Japón", ["#003DA5", "#FFFFFF"]),
];

/**
 * Free agents: the part of the snapshot with no club. They are the entry point
 * of the market for a President who wants to reinforce the squad immediately.
 */
export const FREE_AGENTS: PlayerSeed[] = [
  ["Keylor Navas", "POR", 78, 39, 3, "Costa Rica", "🇨🇷"],
  ["Loris Karius", "POR", 74, 33, 2, "Alemania", "🇩🇪"],
  ["Sergio Ramos", "DFC", 79, 40, 2, "España", "🇪🇸"],
  ["Mats Hummels", "DFC", 80, 37, 3, "Alemania", "🇩🇪"],
  ["Marcos Alonso", "LI", 75, 35, 2, "España", "🇪🇸"],
  ["Juan Cuadrado", "LD", 75, 38, 1, "Colombia", "🇨🇴"],
  ["Alex Telles", "LI", 76, 33, 4, "Brasil", "🇧🇷"],
  ["Ricardo Rodríguez", "LI", 75, 34, 3, "Suiza", "🇨🇭"],
  ["Hakim Ziyech", "MCO", 79, 33, 6, "Marruecos", "🇲🇦"],
  ["Jesse Lingard", "MC", 74, 33, 3, "Inglaterra", "🇬🇧"],
  ["Nemanja Matić", "MCD", 77, 37, 2, "Serbia", "🇷🇸"],
  ["Adnan Januzaj", "EI", 74, 31, 3, "Bélgica", "🇧🇪"],
  ["Anwar El Ghazi", "ED", 74, 31, 2, "Países Bajos", "🇳🇱"],
  ["Ivan Rakitić", "MC", 78, 38, 2, "Croacia", "🇭🇷"],
  ["Lorenzo Insigne", "EI", 79, 34, 4, "Italia", "🇮🇹"],
  ["Wissam Ben Yedder", "DC", 77, 35, 3, "Francia", "🇫🇷"],
  ["Luis Suárez", "DC", 78, 39, 2, "Uruguay", "🇺🇾"],
  ["Edinson Cavani", "DC", 77, 39, 2, "Uruguay", "🇺🇾"],
  ["Kevin Gameiro", "DC", 74, 39, 1, "Francia", "🇫🇷"],
  ["Iago Aspas", "ED", 78, 39, 2, "España", "🇪🇸"],
];

export const PLAYER_SOURCE = {
  version: FC_VERSION,
  /** Where the snapshot came from — kept for auditability. */
  sources: ["EA SPORTS FC 27 ratings repository", "SoFIFA players endpoint"],
  importedAt: "2026-09-10",
  note:
    "Las afiliaciones de club y los valores cambian con las actualizaciones de base de datos de EA. El torneo guarda siempre la versión utilizada.",
};

export function toEuros(millions: number): number {
  return Math.round(millions * 1_000_000);
}
