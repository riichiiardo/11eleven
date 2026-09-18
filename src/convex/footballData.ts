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

type PlayerSeed = [string, Position, number, number, number, string, string];

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

export const CLUBS: ClubSeed[] = [
  {
    name: "Manchester United",
    shortName: "MUN",
    league: "Premier League",
    country: "Inglaterra",
    colors: ["#DA291C", "#FBE122"],
    players: [
      ["André Onana", "POR", 83, 28, 32, "Camerún", "🇨🇲"],
      ["Altay Bayındır", "POR", 76, 27, 9, "Turquía", "🇹🇷"],
      ["Diogo Dalot", "LD", 81, 26, 38, "Portugal", "🇵🇹"],
      ["Noussair Mazraoui", "LD", 80, 27, 32, "Marruecos", "🇲🇦"],
      ["Matthijs de Ligt", "DFC", 84, 26, 58, "Países Bajos", "🇳🇱"],
      ["Lisandro Martínez", "DFC", 84, 27, 52, "Argentina", "🇦🇷"],
      ["Luke Shaw", "LI", 82, 29, 30, "Inglaterra", "🇬🇧"],
      ["Tyrell Malacia", "LI", 77, 26, 18, "Países Bajos", "🇳🇱"],
      ["Casemiro", "MCD", 82, 33, 20, "Brasil", "🇧🇷"],
      ["Manuel Ugarte", "MCD", 82, 24, 45, "Uruguay", "🇺🇾"],
      ["Kobbie Mainoo", "MC", 82, 20, 62, "Inglaterra", "🇬🇧"],
      ["Mason Mount", "MC", 79, 26, 32, "Inglaterra", "🇬🇧"],
      ["Christian Eriksen", "MC", 78, 33, 12, "Dinamarca", "🇩🇰"],
      ["Bruno Fernandes", "MCO", 87, 30, 70, "Portugal", "🇵🇹"],
      ["Marcus Rashford", "EI", 85, 27, 60, "Inglaterra", "🇬🇧"],
      ["Alejandro Garnacho", "ED", 81, 21, 55, "Argentina", "🇦🇷"],
      ["Amad Diallo", "ED", 79, 23, 35, "Costa de Marfil", "🇨🇮"],
      ["Antony", "EI", 78, 25, 25, "Brasil", "🇧🇷"],
      ["Rasmus Højlund", "DC", 83, 22, 52, "Dinamarca", "🇩🇰"],
      ["Joshua Zirkzee", "DC", 79, 24, 38, "Países Bajos", "🇳🇱"],
    ],
  },
  {
    name: "Liverpool FC",
    shortName: "LIV",
    league: "Premier League",
    country: "Inglaterra",
    colors: ["#C8102E", "#00B2A9"],
    players: [
      ["Alisson Becker", "POR", 88, 32, 45, "Brasil", "🇧🇷"],
      ["Caoimhín Kelleher", "POR", 79, 27, 16, "Irlanda", "🇮🇪"],
      ["Trent Alexander-Arnold", "LD", 86, 26, 75, "Inglaterra", "🇬🇧"],
      ["Conor Bradley", "LD", 78, 22, 25, "Irlanda del Norte", "🇬🇧"],
      ["Virgil van Dijk", "DFC", 88, 33, 45, "Países Bajos", "🇳🇱"],
      ["Ibrahima Konaté", "DFC", 84, 26, 60, "Francia", "🇫🇷"],
      ["Andrew Robertson", "LI", 84, 31, 32, "Escocia", "🇬🇧"],
      ["Kostas Tsimikas", "LI", 78, 29, 18, "Grecia", "🇬🇷"],
      ["Ryan Gravenberch", "MCD", 83, 23, 65, "Países Bajos", "🇳🇱"],
      ["Wataru Endō", "MCD", 78, 32, 10, "Japón", "🇯🇵"],
      ["Alexis Mac Allister", "MC", 85, 26, 70, "Argentina", "🇦🇷"],
      ["Curtis Jones", "MC", 80, 24, 35, "Inglaterra", "🇬🇧"],
      ["Dominik Szoboszlai", "MC", 83, 25, 65, "Hungría", "🇭🇺"],
      ["Harvey Elliott", "MCO", 79, 22, 35, "Inglaterra", "🇬🇧"],
      ["Mohamed Salah", "ED", 89, 33, 60, "Egipto", "🇪🇬"],
      ["Federico Chiesa", "ED", 79, 28, 25, "Italia", "🇮🇹"],
      ["Luis Díaz", "EI", 84, 28, 65, "Colombia", "🇨🇴"],
      ["Cody Gakpo", "EI", 83, 26, 55, "Países Bajos", "🇳🇱"],
      ["Darwin Núñez", "DC", 82, 26, 55, "Uruguay", "🇺🇾"],
      ["Diogo Jota", "DC", 84, 28, 50, "Portugal", "🇵🇹"],
    ],
  },
  {
    name: "Arsenal FC",
    shortName: "ARS",
    league: "Premier League",
    country: "Inglaterra",
    colors: ["#EF0107", "#063672"],
    players: [
      ["David Raya", "POR", 85, 30, 40, "España", "🇪🇸"],
      ["Neto", "POR", 78, 36, 5, "Brasil", "🇧🇷"],
      ["Ben White", "LD", 83, 28, 50, "Inglaterra", "🇬🇧"],
      ["Jurriën Timber", "LD", 83, 24, 60, "Países Bajos", "🇳🇱"],
      ["William Saliba", "DFC", 86, 24, 85, "Francia", "🇫🇷"],
      ["Gabriel Magalhães", "DFC", 85, 27, 70, "Brasil", "🇧🇷"],
      ["Riccardo Calafiori", "LI", 80, 23, 45, "Italia", "🇮🇹"],
      ["Oleksandr Zinchenko", "LI", 78, 29, 22, "Ucrania", "🇺🇦"],
      ["Declan Rice", "MCD", 86, 26, 95, "Inglaterra", "🇬🇧"],
      ["Thomas Partey", "MCD", 82, 32, 25, "Ghana", "🇬🇭"],
      ["Martin Ødegaard", "MC", 87, 27, 95, "Noruega", "🇳🇴"],
      ["Mikel Merino", "MC", 83, 29, 45, "España", "🇪🇸"],
      ["Ethan Nwaneri", "MC", 76, 18, 30, "Inglaterra", "🇬🇧"],
      ["Kai Havertz", "MCO", 83, 26, 60, "Alemania", "🇩🇪"],
      ["Bukayo Saka", "ED", 87, 24, 140, "Inglaterra", "🇬🇧"],
      ["Raheem Sterling", "ED", 80, 30, 20, "Inglaterra", "🇬🇧"],
      ["Gabriel Martinelli", "EI", 82, 24, 60, "Brasil", "🇧🇷"],
      ["Leandro Trossard", "EI", 82, 31, 35, "Bélgica", "🇧🇪"],
      ["Gabriel Jesus", "DC", 81, 28, 40, "Brasil", "🇧🇷"],
      ["Reiss Nelson", "DC", 76, 26, 15, "Inglaterra", "🇬🇧"],
    ],
  },
  {
    name: "Real Madrid CF",
    shortName: "RMA",
    league: "LaLiga",
    country: "España",
    colors: ["#FEBE10", "#00529F"],
    players: [
      ["Thibaut Courtois", "POR", 89, 33, 40, "Bélgica", "🇧🇪"],
      ["Andriy Lunin", "POR", 81, 26, 30, "Ucrania", "🇺🇦"],
      ["Dani Carvajal", "LD", 84, 33, 20, "España", "🇪🇸"],
      ["Lucas Vázquez", "LD", 78, 34, 8, "España", "🇪🇸"],
      ["Éder Militão", "DFC", 84, 27, 55, "Brasil", "🇧🇷"],
      ["Antonio Rüdiger", "DFC", 85, 32, 28, "Alemania", "🇩🇪"],
      ["Ferland Mendy", "LI", 82, 30, 25, "Francia", "🇫🇷"],
      ["Fran García", "LI", 79, 26, 20, "España", "🇪🇸"],
      ["Aurélien Tchouaméni", "MCD", 85, 25, 70, "Francia", "🇫🇷"],
      ["Eduardo Camavinga", "MCD", 84, 22, 75, "Francia", "🇫🇷"],
      ["Federico Valverde", "MC", 87, 27, 110, "Uruguay", "🇺🇾"],
      ["Luka Modrić", "MC", 84, 40, 8, "Croacia", "🇭🇷"],
      ["Jude Bellingham", "MC", 89, 22, 180, "Inglaterra", "🇬🇧"],
      ["Arda Güler", "MCO", 80, 21, 65, "Turquía", "🇹🇷"],
      ["Rodrygo Goes", "ED", 86, 25, 100, "Brasil", "🇧🇷"],
      ["Brahim Díaz", "ED", 82, 26, 45, "Marruecos", "🇲🇦"],
      ["Vinícius Júnior", "EI", 90, 25, 180, "Brasil", "🇧🇷"],
      ["Kylian Mbappé", "EI", 91, 27, 180, "Francia", "🇫🇷"],
      ["Endrick", "DC", 79, 20, 45, "Brasil", "🇧🇷"],
      ["Gonzalo García", "DC", 76, 21, 25, "España", "🇪🇸"],
    ],
  },
  {
    name: "FC Barcelona",
    shortName: "BAR",
    league: "LaLiga",
    country: "España",
    colors: ["#A50044", "#004D98"],
    players: [
      ["Marc-André ter Stegen", "POR", 85, 33, 20, "Alemania", "🇩🇪"],
      ["Iñaki Peña", "POR", 78, 27, 12, "España", "🇪🇸"],
      ["Jules Koundé", "LD", 85, 27, 70, "Francia", "🇫🇷"],
      ["Héctor Fort", "LD", 76, 20, 15, "España", "🇪🇸"],
      ["Pau Cubarsí", "DFC", 82, 19, 70, "España", "🇪🇸"],
      ["Ronald Araújo", "DFC", 84, 27, 55, "Uruguay", "🇺🇾"],
      ["Íñigo Martínez", "DFC", 83, 34, 15, "España", "🇪🇸"],
      ["Alejandro Balde", "LI", 83, 22, 60, "España", "🇪🇸"],
      ["Marc Casadó", "MCD", 79, 22, 30, "España", "🇪🇸"],
      ["Frenkie de Jong", "MCD", 86, 28, 65, "Países Bajos", "🇳🇱"],
      ["Pedri", "MC", 88, 23, 120, "España", "🇪🇸"],
      ["Gavi", "MC", 84, 21, 70, "España", "🇪🇸"],
      ["Fermín López", "MC", 80, 22, 45, "España", "🇪🇸"],
      ["Dani Olmo", "MCO", 85, 28, 70, "España", "🇪🇸"],
      ["Lamine Yamal", "ED", 89, 19, 180, "España", "🇪🇸"],
      ["Ferran Torres", "ED", 82, 26, 45, "España", "🇪🇸"],
      ["Raphinha", "EI", 87, 29, 100, "Brasil", "🇧🇷"],
      ["Ansu Fati", "EI", 79, 23, 20, "España", "🇪🇸"],
      ["Robert Lewandowski", "DC", 87, 37, 20, "Polonia", "🇵🇱"],
      ["Pau Víctor", "DC", 75, 24, 10, "España", "🇪🇸"],
    ],
  },
  {
    name: "Inter de Milán",
    shortName: "INT",
    league: "Serie A",
    country: "Italia",
    colors: ["#0068A8", "#0A0A0A"],
    players: [
      ["Yann Sommer", "POR", 86, 37, 8, "Suiza", "🇨🇭"],
      ["Josep Martínez", "POR", 79, 28, 18, "España", "🇪🇸"],
      ["Denzel Dumfries", "LD", 83, 29, 40, "Países Bajos", "🇳🇱"],
      ["Matteo Darmian", "LD", 79, 36, 5, "Italia", "🇮🇹"],
      ["Alessandro Bastoni", "DFC", 85, 26, 75, "Italia", "🇮🇹"],
      ["Benjamin Pavard", "DFC", 83, 29, 45, "Francia", "🇫🇷"],
      ["Francesco Acerbi", "DFC", 82, 37, 6, "Italia", "🇮🇹"],
      ["Federico Dimarco", "LI", 84, 28, 60, "Italia", "🇮🇹"],
      ["Hakan Çalhanoğlu", "MCD", 86, 31, 45, "Turquía", "🇹🇷"],
      ["Kristjan Asllani", "MCD", 78, 24, 25, "Albania", "🇦🇱"],
      ["Nicolò Barella", "MC", 87, 28, 85, "Italia", "🇮🇹"],
      ["Davide Frattesi", "MC", 82, 26, 45, "Italia", "🇮🇹"],
      ["Piotr Zieliński", "MC", 82, 32, 20, "Polonia", "🇵🇱"],
      ["Henrikh Mkhitaryan", "MCO", 83, 37, 8, "Armenia", "🇦🇲"],
      ["Matteo Politano", "ED", 81, 32, 15, "Italia", "🇮🇹"],
      ["Joaquín Correa", "ED", 79, 31, 12, "Argentina", "🇦🇷"],
      ["Carlos Augusto", "EI", 80, 27, 30, "Brasil", "🇧🇷"],
      ["Nicola Zalewski", "EI", 78, 24, 25, "Polonia", "🇵🇱"],
      ["Marcus Thuram", "DC", 85, 28, 70, "Francia", "🇫🇷"],
      ["Lautaro Martínez", "DC", 88, 28, 95, "Argentina", "🇦🇷"],
    ],
  },
  {
    name: "Bayern de Múnich",
    shortName: "BAY",
    league: "Bundesliga",
    country: "Alemania",
    colors: ["#DC052D", "#0066B2"],
    players: [
      ["Manuel Neuer", "POR", 87, 40, 6, "Alemania", "🇩🇪"],
      ["Jonas Urbig", "POR", 76, 22, 15, "Alemania", "🇩🇪"],
      ["Sacha Boey", "LD", 78, 25, 20, "Francia", "🇫🇷"],
      ["Konrad Laimer", "LD", 81, 28, 30, "Austria", "🇦🇹"],
      ["Dayot Upamecano", "DFC", 85, 27, 65, "Francia", "🇫🇷"],
      ["Kim Min-jae", "DFC", 84, 29, 50, "Corea del Sur", "🇰🇷"],
      ["Alphonso Davies", "LI", 85, 25, 60, "Canadá", "🇨🇦"],
      ["Raphaël Guerreiro", "LI", 80, 32, 15, "Portugal", "🇵🇹"],
      ["Joshua Kimmich", "MCD", 87, 31, 55, "Alemania", "🇩🇪"],
      ["João Palhinha", "MCD", 84, 30, 50, "Portugal", "🇵🇹"],
      ["Aleksandar Pavlović", "MC", 80, 21, 50, "Alemania", "🇩🇪"],
      ["Leon Goretzka", "MC", 83, 31, 30, "Alemania", "🇩🇪"],
      ["Jamal Musiala", "MC", 88, 22, 140, "Alemania", "🇩🇪"],
      ["Thomas Müller", "MCO", 84, 36, 8, "Alemania", "🇩🇪"],
      ["Michael Olise", "ED", 86, 24, 100, "Francia", "🇫🇷"],
      ["Leroy Sané", "ED", 85, 29, 55, "Alemania", "🇩🇪"],
      ["Kingsley Coman", "EI", 85, 29, 50, "Francia", "🇫🇷"],
      ["Serge Gnabry", "EI", 83, 30, 35, "Alemania", "🇩🇪"],
      ["Harry Kane", "DC", 90, 32, 90, "Inglaterra", "🇬🇧"],
      ["Mathys Tel", "DC", 78, 20, 35, "Francia", "🇫🇷"],
    ],
  },
  {
    name: "Paris Saint-Germain",
    shortName: "PSG",
    league: "Ligue 1",
    country: "Francia",
    colors: ["#004170", "#DA291C"],
    players: [
      ["Gianluigi Donnarumma", "POR", 88, 27, 45, "Italia", "🇮🇹"],
      ["Matvey Safonov", "POR", 80, 26, 25, "Rusia", "🇷🇺"],
      ["Achraf Hakimi", "LD", 86, 27, 60, "Marruecos", "🇲🇦"],
      ["Presnel Kimpembe", "LD", 78, 30, 8, "Francia", "🇫🇷"],
      ["Marquinhos", "DFC", 85, 32, 30, "Brasil", "🇧🇷"],
      ["Willian Pacho", "DFC", 84, 24, 60, "Ecuador", "🇪🇨"],
      ["Nuno Mendes", "LI", 86, 24, 80, "Portugal", "🇵🇹"],
      ["Lucas Hernández", "LI", 80, 30, 20, "Francia", "🇫🇷"],
      ["João Neves", "MCD", 85, 21, 80, "Portugal", "🇵🇹"],
      ["Fabián Ruiz", "MCD", 84, 30, 55, "España", "🇪🇸"],
      ["Vitinha", "MC", 86, 26, 90, "Portugal", "🇵🇹"],
      ["Warren Zaïre-Emery", "MC", 84, 20, 70, "Francia", "🇫🇷"],
      ["Senny Mayulu", "MC", 76, 19, 20, "Francia", "🇫🇷"],
      ["Lee Kang-in", "MCO", 81, 25, 35, "Corea del Sur", "🇰🇷"],
      ["Ousmane Dembélé", "ED", 87, 28, 70, "Francia", "🇫🇷"],
      ["Désiré Doué", "ED", 81, 21, 60, "Francia", "🇫🇷"],
      ["Bradley Barcola", "EI", 85, 23, 80, "Francia", "🇫🇷"],
      ["Khvicha Kvaratskhelia", "EI", 87, 25, 100, "Georgia", "🇬🇪"],
      ["Gonçalo Ramos", "DC", 82, 24, 45, "Portugal", "🇵🇹"],
      ["Ibrahim Mbaye", "DC", 75, 18, 20, "Francia", "🇫🇷"],
    ],
  },
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
