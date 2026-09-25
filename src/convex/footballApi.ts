/**
 * 11Eleven — Catálogo de jugadores: capa de descarga ("use node").
 *
 * Dos fuentes vivas alimentan el catálogo versionado:
 *
 * 1. **EA SPORTS FC 27 · ratings oficiales**
 *    (`https://www.ea.com/games/ea-sports-fc/ratings?page=N`) — fuente por
 *    defecto: 19.700+ jugadores, 100 por página, renderizados en el HTML dentro
 *    de `__NEXT_DATA__`. EA no aplica protección anti-bots, así que responde
 *    igual desde IPs de datacenter (la IP de Convex incluida).
 *
 * 2. **SoFIFA** (`https://sofifa.com/api/players`) — opcional. SoFIFA está
 *    detrás de Cloudflare y responde 403 a las IPs de datacenter: solo funciona
 *    con un proxy de residente/forwarding configurado en `SOFIFA_PROXY_URL`.
 *    Sin ese proxy, el panel de Administración lo indica y se recurre al
 *    snapshot local.
 *
 * Ambas fuentes convergen en `internal.footballSync.applyCatalog`, que hace
 * upsert por nombre en lotes acotados (Convex permite 4.096 lecturas de índice
 * y 16.000 escrituras por transacción, y una action Node corre 10 minutos como
 * máximo). Por eso la sincronización avanza con un cursor de página desde el
 * panel de Administración en lugar de intentar importar todo de una sola vez.
 */

"use node";

import axios, { type AxiosRequestConfig } from "axios";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { FREE_AGENT_CLUB, type Position } from "./rulesEngine";

export const SYNC_SOURCE = "SoFIFA";
export const EA_SOURCE = "EA Ratings";
/** English Premier League on SoFIFA; the sync accepts any league id. */
export const DEFAULT_LEAGUE_ID = 13;
export const MAX_PAGES = 30;
export const PAGE_STEP = 60;

/* ------------------------------------------------------------------ *
 * EA Ratings (fuente por defecto)
 * ------------------------------------------------------------------ */

export const EA_RATINGS_URL = "https://www.ea.com/games/ea-sports-fc/ratings";
export const EA_PAGE_SIZE = 100;
/** Páginas por llamada de sincronización (100 jugadores por página). */
export const EA_BATCH_PAGES = 20;
export const EA_MAX_BATCH = 40;
export const EA_CONCURRENCY = 4;
/** Aplicamos el catálogo en bloques dentro del presupuesto de transacción. */
export const APPLY_CHUNK = 1_000;

const SOFIFA_BASE = "https://sofifa.com";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,text/plain,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
} as const;

export type FetchedPlayer = {
  name: string;
  position: Position;
  ovr: number;
  age: number;
  value: number;
  nationality: string;
  flag: string;
  /** Team name as the source reports it; normalized later against the tournament. */
  realClub: string;
  realLeague: string;
};

export type FetchResult = {
  players: FetchedPlayer[];
  source: string;
  pages: number;
  /** True when a page came back without players: the list is exhausted. */
  exhausted: boolean;
  note: string | null;
};

/* ------------------------------------------------------------------ *
 * Utilidades defensivas
 * ------------------------------------------------------------------ */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.replace(/[^\d.]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

const POSITION_MAP: Array<[string, Position]> = [
  ["GK", "POR"],
  ["CB", "DFC"],
  ["LCB", "DFC"],
  ["RCB", "DFC"],
  ["LB", "LI"],
  ["LWB", "LI"],
  ["RB", "LD"],
  ["RWB", "LD"],
  ["CDM", "MCD"],
  ["LDM", "MCD"],
  ["RDM", "MCD"],
  ["CM", "MC"],
  ["LCM", "MC"],
  ["RCM", "MC"],
  ["CAM", "MCO"],
  ["LAM", "MCO"],
  ["RAM", "MCO"],
  ["LW", "EI"],
  ["LM", "EI"],
  ["RW", "ED"],
  ["RM", "ED"],
  ["CF", "DC"],
  ["ST", "DC"],
];

export function positionFrom(raw: unknown): Position | null {
  const label = asString(raw);
  if (!label) return null;
  const first = label.split(",")[0]!.trim().toUpperCase();
  for (const [code, mapped] of POSITION_MAP) {
    if (first === code || first.startsWith(code)) return mapped;
  }
  return null;
}

function flagFrom(raw: string): string {
  const emoji = raw.match(/\p{Extended_Pictographic}/u);
  return emoji?.[0] ?? "🏳️";
}

/**
 * Banderas y nombres en español para las nacionalidades que EA reporta en
 * inglés, así el buscador del mercado funciona igual para el snapshot y para
 * el catálogo importado.
 */
const NATIONS: Record<string, [string, string]> = {
  Argentina: ["Argentina", "🇦🇷"],
  Australia: ["Australia", "🇦🇺"],
  Austria: ["Austria", "🇦🇹"],
  Belgium: ["Bélgica", "🇧🇪"],
  Bolivia: ["Bolivia", "🇧🇴"],
  Brazil: ["Brasil", "🇧🇷"],
  Bulgaria: ["Bulgaria", "🇧🇬"],
  Cameroon: ["Camerún", "🇨🇲"],
  Canada: ["Canadá", "🇨🇦"],
  Chile: ["Chile", "🇨🇱"],
  Colombia: ["Colombia", "🇨🇴"],
  "Costa Rica": ["Costa Rica", "🇨🇷"],
  "Croatia": ["Croacia", "🇭🇷"],
  "Czech Republic": ["República Checa", "🇨🇿"],
  Denmark: ["Dinamarca", "🇩🇰"],
  "Dominican Republic": ["República Dominicana", "🇩🇴"],
  Ecuador: ["Ecuador", "🇪🇨"],
  Egypt: ["Egipto", "🇪🇬"],
  England: ["Inglaterra", "🇬🇧"],
  Finland: ["Finlandia", "🇫🇮"],
  France: ["Francia", "🇫🇷"],
  Germany: ["Alemania", "🇩🇪"],
  Ghana: ["Ghana", "🇬🇭"],
  Greece: ["Grecia", "🇬🇷"],
  Holland: ["Países Bajos", "🇳🇱"],
  Hungary: ["Hungría", "🇭🇺"],
  Iceland: ["Islandia", "🇮🇸"],
  Indonesia: ["Indonesia", "🇮🇩"],
  Iran: ["Irán", "🇮🇷"],
  Iraq: ["Irak", "🇮🇶"],
  Ireland: ["Irlanda", "🇮🇪"],
  "Republic of Ireland": ["Irlanda", "🇮🇪"],
  Italy: ["Italia", "🇮🇹"],
  Jamaica: ["Jamaica", "🇯🇲"],
  Japan: ["Japón", "🇯🇵"],
  Kenya: ["Kenia", "🇰🇪"],
  "Korea Republic": ["Corea del Sur", "🇰🇷"],
  "Korea DPR": ["Corea del Norte", "🇰🇵"],
  Mexico: ["México", "🇲🇽"],
  Morocco: ["Marruecos", "🇲🇦"],
  Nigeria: ["Nigeria", "🇳🇬"],
  Norway: ["Noruega", "🇳🇴"],
  Poland: ["Polonia", "🇵🇱"],
  Portugal: ["Portugal", "🇵🇹"],
  Romania: ["Rumanía", "🇷🇴"],
  Russia: ["Rusia", "🇷🇺"],
  "Saudi Arabia": ["Arabia Saudita", "🇸🇦"],
  Scotland: ["Escocia", "🇬🇧"],
  Senegal: ["Senegal", "🇸🇳"],
  Serbia: ["Serbia", "🇷🇸"],
  Slovakia: ["Eslovaquia", "🇸🇰"],
  Slovenia: ["Eslovenia", "🇸🇮"],
  "South Africa": ["Sudáfrica", "🇿🇦"],
  Spain: ["España", "🇪🇸"],
  Sweden: ["Suecia", "🇸🇪"],
  Switzerland: ["Suiza", "🇨🇭"],
  Turkey: ["Turquía", "🇹🇷"],
  Ukraine: ["Ucrania", "🇺🇦"],
  "United States": ["Estados Unidos", "🇺🇸"],
  Uruguay: ["Uruguay", "🇺🇾"],
  Venezuela: ["Venezuela", "🇻🇪"],
  Wales: ["Gales", "🇬🇧"],
  "Albania": ["Albania", "🇦🇱"],
  "Algeria": ["Argelia", "🇩🇿"],
  "Angola": ["Angola", "🇦🇴"],
  "Armenia": ["Armenia", "🇦🇲"],
  "Azerbaijan": ["Azerbaiyán", "🇦🇿"],
  "Bahrain": ["Baréin", "🇧🇭"],
  "Belarus": ["Bielorrusia", "🇧🇾"],
  "Bosnia and Herzegovina": ["Bosnia y Herzegovina", "🇧🇦"],
  "Burkina Faso": ["Burkina Faso", "🇧🇫"],
  "China PR": ["China", "🇨🇳"],
  "Chinese Taipei": ["Taiwán", "🇹🇼"],
  "Ivory Coast": ["Costa de Marfil", "🇨🇮"],
  "Côte d'Ivoire": ["Costa de Marfil", "🇨🇮"],
  "Cape Verde Islands": ["Cabo Verde", "🇨🇻"],
  "Central African Republic": ["República Centroafricana", "🇨🇫"],
  "Congo DR": ["RD Congo", "🇨🇩"],
  "Curacao": ["Curazao", "🇨🇼"],
  "Curaçao": ["Curazao", "🇨🇼"],
  "El Salvador": ["El Salvador", "🇸🇻"],
  "Equatorial Guinea": ["Guinea Ecuatorial", "🇬🇶"],
  "Faroe Islands": ["Islas Feroe", "🇫🇴"],
  "Guinea-Bissau": ["Guinea-Bisáu", "🇬🇼"],
  "Hong Kong": ["Hong Kong", "🇭🇰"],
  "Israel": ["Israel", "🇮🇱"],
  "Jordan": ["Jordania", "🇯🇴"],
  "Kazakhstan": ["Kazajistán", "🇰🇿"],
  "Kosovo": ["Kosovo", "🇽🇰"],
  "Lebanon": ["Líbano", "🇱🇧"],
  "Libya": ["Libia", "🇱🇾"],
  "Macedonia": ["Macedonia del Norte", "🇲🇰"],
  "North Macedonia": ["Macedonia del Norte", "🇲🇰"],
  "Malaysia": ["Malasia", "🇲🇾"],
  "Mali": ["Malí", "🇲🇱"],
  "Moldova": ["Moldavia", "🇲🇩"],
  "Montenegro": ["Montenegro", "🇲🇪"],
  "New Zealand": ["Nueva Zelanda", "🇳🇿"],
  "Niger": ["Níger", "🇳🇪"],
  "Northern Ireland": ["Irlanda del Norte", "🇬🇧"],
  "Panama": ["Panamá", "🇵🇦"],
  "Paraguay": ["Paraguay", "🇵🇾"],
  "Peru": ["Perú", "🇵🇪"],
  "Philippines": ["Filipinas", "🇵🇭"],
  "Qatar": ["Catar", "🇶🇦"],
  "Saudi": ["Arabia Saudita", "🇸🇦"],
  "Sri Lanka": ["Sri Lanka", "🇱🇰"],
  "Syria": ["Siria", "🇸🇾"],
  "Togo": ["Togo", "🇹🇬"],
  "Trinidad and Tobago": ["Trinidad y Tobago", "🇹🇹"],
  "Tunisia": ["Túnez", "🇹🇳"],
  "United Arab Emirates": ["Emiratos Árabes Unidos", "🇦🇪"],
  "Uzbekistan": ["Uzbekistán", "🇺🇿"],
  "Zambia": ["Zambia", "🇿🇲"],
  "Zimbabwe": ["Zimbabue", "🇿🇼"],
  "Afghanistan": ["Afganistán", "🇦🇫"],
  "Andorra": ["Andorra", "🇦🇩"],
  "Antigua and Barbuda": ["Antigua y Barbuda", "🇦🇬"],
  "Bangladesh": ["Bangladés", "🇧🇩"],
  "Barbados": ["Barbados", "🇧🇧"],
  "Benin": ["Benín", "🇧🇯"],
  "Bermuda": ["Bermudas", "🇧🇲"],
  "Burundi": ["Burundi", "🇧🇮"],
  "Chad": ["Chad", "🇹🇩"],
  "Comoros": ["Comoras", "🇰🇲"],
  "Congo": ["Congo", "🇨🇬"],
  "Cuba": ["Cuba", "🇨🇺"],
  "Cyprus": ["Chipre", "🇨🇾"],
  "Eritrea": ["Eritrea", "🇪🇷"],
  "Estonia": ["Estonia", "🇪🇪"],
  "Gambia": ["Gambia", "🇬🇲"],
  "Gabon": ["Gabón", "🇬🇦"],
  "Georgia": ["Georgia", "🇬🇪"],
  "Gibraltar": ["Gibraltar", "🇬🇮"],
  "Grenada": ["Granada", "🇬🇩"],
  "Guatemala": ["Guatemala", "🇬🇹"],
  "Guyana": ["Guyana", "🇬🇾"],
  "Haiti": ["Haití", "🇭🇹"],
  "Honduras": ["Honduras", "🇭🇳"],
  "Guinea": ["Guinea", "🇬🇳"],
  "India": ["India", "🇮🇳"],
  "Latvia": ["Letonia", "🇱🇻"],
  "Liberia": ["Liberia", "🇱🇷"],
  "Liechtenstein": ["Liechtenstein", "🇱🇮"],
  "Lithuania": ["Lituania", "🇱🇹"],
  "Luxembourg": ["Luxemburgo", "🇱🇺"],
  "Madagascar": ["Madagascar", "🇲🇬"],
  "Malawi": ["Malaui", "🇲🇼"],
  "Malta": ["Malta", "🇲🇹"],
  "Mauritania": ["Mauritania", "🇲🇷"],
  "Mauritius": ["Mauricio", "🇲🇺"],
  "Montserrat": ["Montserrat", "🇲🇸"],
  "Mozambique": ["Mozambique", "🇲🇿"],
  "Namibia": ["Namibia", "🇳🇦"],
  "New Caledonia": ["Nueva Caledonia", "🇳🇨"],
  "Oman": ["Omán", "🇴🇲"],
  "Pakistan": ["Pakistán", "🇵🇰"],
  "Palestine": ["Palestina", "🇵🇸"],
  "Puerto Rico": ["Puerto Rico", "🇵🇷"],
  "Rwanda": ["Ruanda", "🇷🇼"],
  "São Tomé e Príncipe": ["Santo Tomé y Príncipe", "🇸🇹"],
  "São Tomé and Príncipe": ["Santo Tomé y Príncipe", "🇸🇹"],
  "Sierra Leone": ["Sierra Leona", "🇸🇱"],
  "Somalia": ["Somalia", "🇸🇴"],
  "St. Kitts and Nevis": ["San Cristóbal y Nieves", "🇰🇳"],
  "St. Lucia": ["Santa Lucía", "🇱🇨"],
  "Suriname": ["Surinam", "🇸🇷"],
  "Tanzania": ["Tanzania", "🇹🇿"],
  "Thailand": ["Tailandia", "🇹🇭"],
  "Uganda": ["Uganda", "🇺🇬"],
  "Vanuatu": ["Vanuatu", "🇻🇺"],
  "Yemen": ["Yemen", "🇾🇪"],
};

/** English label (EA) → [nombre en español, bandera]. */
export function nationOf(label: string | null): [string, string] {
  if (!label) return ["—", "🌍"];
  const known = NATIONS[label];
  if (known) return known;
  return [label, "🌍"];
}

/**
 * Valor de mercado estimado en euros cuando la fuente no trae uno (EA solo
 * publica ratings). La curva está calibrada sobre el snapshot del juego:
 * ~0,3 M€ a OVR 60 creciendo 22 % por punto, tope de 200 M€, con depreciación
 * exponencial a partir de los 28 años.
 */
export function valueFor(ovr: number, age: number): number {
  const base = 0.3 * Math.pow(1.22, Math.min(ovr, 95) - 60);
  const ageFactor =
    age <= 21 ? 0.85 : age <= 28 ? 1 : Math.max(0.1, Math.pow(0.86, age - 28));
  const millions = Math.min(200, Math.max(0.05, base * ageFactor));
  return Math.round((millions * 1_000_000) / 100_000) * 100_000;
}

function ageFrom(raw: unknown): number {
  const text = asString(raw);
  if (!text) return 25;
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return 25;
  const birth = Date.UTC(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
  const years = Math.floor((Date.now() - birth) / (365.25 * 24 * 60 * 60 * 1000));
  if (!Number.isFinite(years)) return 25;
  return Math.min(45, Math.max(16, years));
}

/* ------------------------------------------------------------------ *
 * SoFIFA (opcional, requiere proxy)
 * ------------------------------------------------------------------ */

/**
 * Proxy opcional para SoFIFA. Cloudflare bloquea las IPs de datacenter, así
 * que sin `SOFIFA_PROXY_URL` la petición sale desde la IP del servidor y
 * recibe un 403. Se admiten proxies HTTP(S) con o sin autenticación:
 * `http://usuario:clave@host:puerto`.
 */
function sofifaProxy(): AxiosRequestConfig["proxy"] {
  const raw = process.env.SOFIFA_PROXY_URL?.trim();
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConvexError(
      "SOFIFA_PROXY_URL no es una URL válida. Usa el formato http://usuario:clave@host:puerto.",
    );
  }
  if (url.protocol === "socks4:" || url.protocol === "socks5:") {
    throw new ConvexError(
      "SOFIFA_PROXY_URL usa SOCKS, que axios no soporta. Configura un proxy HTTP(S) en su lugar.",
    );
  }
  const secure = url.protocol === "https:";
  return {
    protocol: url.protocol.replace(":", ""),
    host: url.hostname,
    port: Number(url.port || (secure ? 443 : 80)),
    auth: url.username
      ? {
          username: decodeURIComponent(url.username),
          password: decodeURIComponent(url.password || ""),
        }
      : undefined,
  };
}

export function parsePlayerRow(
  row: Record<string, unknown>,
  leagueFallback: string,
): FetchedPlayer | null {
  const name = asString(row.name) ?? asString(row.player) ?? asString(row.long_name);
  if (!name) return null;
  const ovr = asNumber(row.ovr) ?? asNumber(row.overall) ?? asNumber(row.rating);
  if (ovr === null || ovr < 40 || ovr > 99) return null;
  const position = positionFrom(
    asString(row.position) ?? asString(row.positions) ?? asString(row.best_position),
  );
  if (!position) return null;

  const nationality =
    asString(row.nationality) ?? asString(row.nation) ?? asString(row.nat) ?? "";
  const value =
    asNumber(row.value) ?? asNumber(row.value_eur) ?? asNumber(row.market_value) ?? 0;

  return {
    name,
    position,
    ovr: Math.round(ovr),
    age: Math.max(15, Math.min(45, Math.round(asNumber(row.age) ?? 0))),
    value: Math.max(0, Math.round(value)),
    nationality,
    flag: flagFrom(nationality),
    realClub: asString(row.team) ?? asString(row.club) ?? "",
    realLeague: asString(row.league) ?? asString(row.competition) ?? leagueFallback,
  };
}

function rowsOf(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  const record = asRecord(data);
  if (record) {
    for (const key of ["players", "data", "results", "items"]) {
      const inner = record[key];
      if (Array.isArray(inner)) return inner as Record<string, unknown>[];
    }
  }
  return [];
}

function sofifaUrl(params: {
  teamId?: number;
  leagueId?: number;
  offset: number;
  r: string;
}): string {
  const query = new URLSearchParams({
    r: params.r,
    unit: "EUR",
    offset: String(params.offset),
  });
  if (typeof params.teamId === "number") query.set("T", String(params.teamId));
  if (typeof params.leagueId === "number") query.set("league", String(params.leagueId));
  return `${SOFIFA_BASE}/api/players?${query.toString()}`;
}

async function fetchSofifaPage(url: string): Promise<Record<string, unknown>[]> {
  let response;
  try {
    response = await axios.get(url, {
      headers: BROWSER_HEADERS,
      timeout: 20_000,
      responseType: "json",
      proxy: sofifaProxy(),
    });
  } catch (cause) {
    const status = axios.isAxiosError(cause) ? cause.response?.status : undefined;
    if (status === 403 || status === 503) {
      throw new ConvexError(
        "SoFIFA devolvió un bloqueo de Cloudflare (403) desde la IP del servidor. " +
          "Configura un proxy HTTP(S) en la variable SOFIFA_PROXY_URL (Convex → Settings → Environment Variables) " +
          "o sincroniza desde EA Ratings, que no requiere proxy.",
      );
    }
    throw new ConvexError(
      `No se pudo contactar la API de SoFIFA${status ? ` (HTTP ${status})` : ""}. Reintentar más tarde suele bastar.`,
    );
  }
  return rowsOf(response.data);
}

/**
 * Pulls player rows from SoFIFA's JSON API. Team mode (`teamId`) and league
 * mode (`leagueId`) are both supported; `startPage` moves the cursor so the
 * Administration panel can resume where it left off. Pagination stops on the
 * first page without valid players or at MAX_PAGES.
 */
export const fetchPlayers = async (params: {
  teamId?: number;
  leagueId?: number;
  pages?: number;
  startPage?: number;
  r?: string;
}): Promise<FetchResult> => {
  const r = params.r ?? "2700";
  const leagueFallback =
    typeof params.leagueId === "number" ? `Liga ${params.leagueId}` : "SoFIFA";
  const maxPages = Math.max(1, Math.min(params.pages ?? MAX_PAGES, MAX_PAGES));
  const startPage = Math.max(0, Math.floor(params.startPage ?? 0));

  const players: FetchedPlayer[] = [];
  let pages = 0;
  let exhausted = false;
  for (let page = 0; page < maxPages; page += 1) {
    const rows = await fetchSofifaPage(
      sofifaUrl({
        teamId: params.teamId,
        leagueId: params.leagueId,
        offset: (startPage + page) * PAGE_STEP,
        r,
      }),
    );
    let valid = 0;
    for (const row of rows) {
      const parsed = parsePlayerRow(row, leagueFallback);
      if (parsed) {
        players.push(parsed);
        valid += 1;
      }
    }
    pages += 1;
    if (valid === 0) {
      exhausted = true;
      break;
    }
  }

  return {
    players,
    source: SYNC_SOURCE,
    pages,
    exhausted,
    note: players.length === 0 ? "La respuesta no contenía jugadores válidos." : null,
  };
};

/* ------------------------------------------------------------------ *
 * EA Ratings · descarga paginada
 * ------------------------------------------------------------------ */

function extractNextData(html: string): Record<string, unknown> | null {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) return null;
  try {
    return asRecord(JSON.parse(match[1]));
  } catch {
    return null;
  }
}

function parseEaPage(html: string): {
  items: Record<string, unknown>[];
  totalItems: number;
} {
  const data = extractNextData(html);
  if (!data) {
    throw new ConvexError(
      "EA Ratings devolvió una página sin datos embebidos (posible bloqueo o cambio de estructura).",
    );
  }
  const pageProps = asRecord(asRecord(data.props)?.pageProps);
  const details = asRecord(pageProps?.ratingDetails);
  const items = Array.isArray(details?.items)
    ? (details.items as Record<string, unknown>[])
    : [];
  const totalItems = asNumber(details?.totalItems) ?? 0;
  return { items, totalItems };
}

/** Maps one EA ratings row onto the catalogue shape. */
export function eaPlayerFrom(raw: Record<string, unknown>): FetchedPlayer | null {
  const first = asString(raw.firstName) ?? "";
  const last = asString(raw.lastName) ?? "";
  const name = asString(raw.commonName) ?? `${first} ${last}`.trim();
  if (!name) return null;

  const ovr = asNumber(raw.overallRating);
  if (ovr === null || ovr < 40 || ovr > 99) return null;

  const position = positionFrom(asRecord(raw.position)?.shortLabel);
  if (!position) return null;

  const age = ageFrom(raw.birthdate);
  const [nationality, flag] = nationOf(asString(asRecord(raw.nationality)?.label));
  const team = asString(asRecord(raw.team)?.label);
  const league = asString(raw.leagueName);

  return {
    name,
    position,
    ovr: Math.round(ovr),
    age,
    value: valueFor(Math.round(ovr), age),
    nationality,
    flag,
    realClub: team ?? FREE_AGENT_CLUB,
    realLeague: team ? (league ?? "—") : "Sin club",
  };
}

async function fetchEaPage(page: number): Promise<{
  items: Record<string, unknown>[];
  totalItems: number;
}> {
  const url = `${EA_RATINGS_URL}?page=${page}`;
  let lastStatus: number | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await axios.get(url, {
        headers: BROWSER_HEADERS,
        timeout: 25_000,
        responseType: "text",
        maxRedirects: 5,
      });
      const html = typeof response.data === "string" ? response.data : String(response.data);
      return parseEaPage(html);
    } catch (cause) {
      if (cause instanceof ConvexError) throw cause;
      const status = axios.isAxiosError(cause) ? cause.response?.status : undefined;
      lastStatus = status;
      // 429/5xx are transient: brief backoff and retry before giving up.
      if (status === 429 || (status !== undefined && status >= 500)) {
        await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
        continue;
      }
      if (status !== undefined && status >= 400) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw new ConvexError(
    `EA Ratings no respondió${lastStatus ? ` (HTTP ${lastStatus})` : ""}. Reintenta en unos segundos.`,
  );
}

async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

export type EaBatchResult = {
  players: FetchedPlayer[];
  /** First page requested (1-based). */
  startPage: number;
  /** Cursor to resume from on the next call. */
  nextPage: number;
  totalPages: number;
  totalItems: number;
  fetched: number;
  skipped: number;
  errors: string[];
  /** True when the last requested page was already the end of the list. */
  done: boolean;
};

/**
 * Downloads a bounded slice of the official ratings list. Pages are fetched a
 * few at a time so a full catalogue run (≈200 páginas) can be driven from the
 * UI in short, resumable calls instead of one long action.
 */
export async function fetchEaBatch(
  startPage: number,
  pages: number,
): Promise<EaBatchResult> {
  const first = Math.max(1, Math.floor(startPage));
  const count = Math.max(1, Math.min(Math.floor(pages), EA_MAX_BATCH));
  const requested = Array.from({ length: count }, (_, index) => first + index);

  const failures: Array<string | null> = await mapConcurrent(
    requested,
    EA_CONCURRENCY,
    async (page) => {
      try {
        const { items, totalItems } = await fetchEaPage(page);
        return JSON.stringify({ page, items, totalItems });
      } catch (cause) {
        return cause instanceof ConvexError ? `#${page}:${cause.message}` : `#${page}:error`;
      }
    },
  );

  const players: FetchedPlayer[] = [];
  const errors: string[] = [];
  let totalItems = 0;
  let seen = 0;
  let skipped = 0;
  let highest = first - 1;
  let emptyPage = false;

  for (const payload of failures) {
    if (!payload) continue;
    if (payload.startsWith("#")) {
      errors.push(payload.slice(1));
      continue;
    }
    const parsed = JSON.parse(payload) as {
      page: number;
      items: Record<string, unknown>[];
      totalItems: number;
    };
    if (parsed.totalItems > 0) totalItems = parsed.totalItems;
    highest = Math.max(highest, parsed.page);
    if (parsed.items.length === 0) emptyPage = true;
    seen += parsed.items.length;
    for (const item of parsed.items) {
      const mapped = eaPlayerFrom(item);
      if (mapped) players.push(mapped);
      else skipped += 1;
    }
  }

  if (players.length === 0 && errors.length > 0) {
    throw new ConvexError(errors[0] ?? "EA Ratings no respondió.");
  }

  const totalPages =
    totalItems > 0 ? Math.ceil(totalItems / EA_PAGE_SIZE) : highest + 1;
  const nextPage = highest + 1;
  const done =
    players.length === 0 ||
    emptyPage ||
    (totalItems > 0 && nextPage > totalPages) ||
    errors.length > 0;

  return {
    players,
    startPage: first,
    nextPage,
    totalPages,
    totalItems,
    fetched: seen,
    skipped,
    errors,
    done,
  };
}

/* ------------------------------------------------------------------ *
 * Sincronización
 * ------------------------------------------------------------------ */

type SyncOutcome = {
  /** Etiqueta de la fuente realmente usada. */
  source: string;
  fallback: boolean;
  /** True cuando no queda nada por importar en esta fuente. */
  done: boolean;
  /** Cursor para la siguiente llamada. */
  page: number;
  totalPages: number;
  fetched: number;
  skipped: number;
  inserted: number;
  updated: number;
  unchanged: number;
  fcVersion: string;
  note: string | null;
};

function versionLabel(source: "ea" | "sofifa"): string {
  const now = new Date();
  const stamp = `${String(now.getDate()).padStart(2, "0")}/${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}/${now.getFullYear()}`;
  return source === "ea" ? `FC 27 · EA Ratings ${stamp}` : `FC 27 · SoFIFA ${stamp}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

/**
 * Administration entry point. Trabaja por lotes con un cursor:
 *
 * - `source: "ea"` descarga N páginas de los ratings oficiales de EA (100
 *   jugadores por página) y devuelve el cursor de la siguiente.
 * - `source: "sofifa"` hace lo propio con la API de SoFIFA (60 por página) y
 *   solo tiene éxito detrás de `SOFIFA_PROXY_URL`.
 * - `source: "snapshot"` reimporta el snapshot local versionado.
 *
 * El upsert nunca toca plantillas ni presupuestos: solo la tabla `players`.
 * Si la fuente vive falla, se registra el error y se aplica el snapshot para
 * que el torneo siempre quede jugable.
 */
export const syncCatalog = action({
  args: {
    source: v.optional(v.union(v.literal("ea"), v.literal("sofifa"), v.literal("snapshot"))),
    page: v.optional(v.number()),
    pages: v.optional(v.number()),
    teamId: v.optional(v.number()),
    leagueId: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SyncOutcome> => {
    const { actorName } = await ctx.runQuery(
      internal.footballSync.assertCatalogAdmin,
      {},
    );
    const source = args.source ?? "ea";

    if (source === "snapshot") {
      const summary = await ctx.runMutation(internal.footballSync.applySnapshot, {
        actorName,
      });
      return {
        source: summary.source,
        fallback: false,
        done: true,
        page: 0,
        totalPages: 0,
        fetched: summary.inserted,
        skipped: 0,
        inserted: summary.inserted,
        updated: summary.updated,
        unchanged: summary.unchanged,
        fcVersion: summary.fcVersion,
        note: "Snapshot local aplicado.",
      };
    }

    try {
      const fcVersion = versionLabel(source);
      let players: FetchedPlayer[] = [];
      let nextPage = Math.max(0, Math.floor(args.page ?? (source === "ea" ? 1 : 0)));
      let totalPages = 0;
      let fetched = 0;
      let skipped = 0;
      let done = false;
      let note: string | null = null;

      if (source === "ea") {
        const batch = await fetchEaBatch(
          Math.max(1, Math.floor(args.page ?? 1)),
          Math.max(1, Math.min(args.pages ?? EA_BATCH_PAGES, EA_MAX_BATCH)),
        );
        players = batch.players;
        nextPage = batch.nextPage;
        totalPages = batch.totalPages;
        fetched = batch.fetched;
        done = batch.done;
        if (batch.errors.length > 0) {
          note = `Páginas incompletas: ${batch.errors.join(" · ")}`;
        }
        skipped = batch.skipped;
        if (fetched === 0 && players.length === 0) {
          throw new ConvexError(
            "EA Ratings no devolvió jugadores en esta página. Reintenta en unos segundos.",
          );
        }
      } else {
        const startPage = Math.max(0, Math.floor(args.page ?? 0));
        const result = await fetchPlayers({
          teamId: args.teamId,
          leagueId: args.leagueId,
          pages: args.pages,
          startPage,
        });
        if (result.players.length === 0) {
          throw new ConvexError(
            result.note ?? "SoFIFA no devolvió jugadores para los filtros indicados.",
          );
        }
        players = result.players;
        fetched = result.players.length;
        nextPage = startPage + result.pages;
        done = result.exhausted || result.pages < Math.max(1, Math.min(args.pages ?? MAX_PAGES, MAX_PAGES));
      }

      let inserted = 0;
      let updated = 0;
      let unchanged = 0;
      for (const part of chunk(players, APPLY_CHUNK)) {
        const summary = await ctx.runMutation(internal.footballSync.applyCatalog, {
          players: part,
          fcVersion,
          source: source === "ea" ? EA_SOURCE : SYNC_SOURCE,
          log: false,
        });
        inserted += summary.inserted;
        updated += summary.updated;
        unchanged += summary.unchanged;
      }

      if (players.length > 0) {
        await ctx.runMutation(internal.footballSync.logSyncSuccess, {
          actorName,
          source: source === "ea" ? EA_SOURCE : SYNC_SOURCE,
          summary: { inserted, updated, unchanged, fcVersion },
          note:
            note ??
            (done ? undefined : `lote descargado hasta la página ${nextPage}; la sincronización continúa`),
        });
      }

      return {
        source: source === "ea" ? EA_SOURCE : SYNC_SOURCE,
        fallback: false,
        done,
        page: nextPage,
        totalPages,
        fetched,
        skipped,
        inserted,
        updated,
        unchanged,
        fcVersion,
        note,
      };
    } catch (cause) {
      const reason =
        cause instanceof ConvexError
          ? String(cause.message)
          : cause instanceof Error
            ? cause.message
            : "Error desconocido descargando el catálogo.";

      await ctx.runMutation(internal.footballSync.logSyncFailure, {
        actorName,
        reason,
      });

      const fallback = await ctx.runMutation(internal.footballSync.applySnapshot, {
        actorName,
      });
      return {
        source: fallback.source,
        fallback: true,
        done: true,
        page: 0,
        totalPages: 0,
        fetched: fallback.inserted,
        skipped: 0,
        inserted: fallback.inserted,
        updated: fallback.updated,
        unchanged: fallback.unchanged,
        fcVersion: fallback.fcVersion,
        note: `Fuente no accesible: ${reason} Se aplicó el snapshot local como respaldo.`,
      };
    }
  },
});
