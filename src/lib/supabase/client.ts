import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";

/**
 * 11Eleven — capa de acceso a datos (Supabase).
 *
 * Reemplaza a Convex: lecturas directas del navegador con la anon key
 * (RLS limita cada tabla a miembros/administradores de la liga) y escrituras
 * exclusivamente por RPCs security definer (supabase/rpc.sql).
 */

// Normaliza los valores: quita comillas envolventes, espacios, y a la URL le
// añade https:// si falta y le quita la barra final.
const clean = (v: string) => v.trim().replace(/^["']+/, "").replace(/["',;]+$/, "");

// Variables inyectadas por la plataforma (vía Keys / API keys).
const envUrl = clean((import.meta.env.VITE_SUPABASE_URL ?? "") as string);
const envKey = clean((import.meta.env.VITE_SUPABASE_ANON_KEY ?? "") as string);

// Fallback manual: si la plataforma no inyectó las variables, se permite pegar
// la Project URL y la anon key en pantalla (se guardan en localStorage). URL y
// anon key son credenciales públicas del navegador; la seguridad la aportan
// RLS y las RPC security definer.
const LS_URL = "11eleven.supabase.url";
const LS_KEY = "11eleven.supabase.anonKey";

function lsGet(name: string): string {
  try {
    return localStorage.getItem(name) ?? "";
  } catch {
    return "";
  }
}

const rawUrl = envUrl || clean(lsGet(LS_URL));
const anonKey = envKey || clean(lsGet(LS_KEY));

/** Guarda la configuración manual y recarga la app para reinicializar el cliente. */
export function saveSupabaseConfig(projectUrl: string, anonKeyValue: string): void {
  try {
    localStorage.setItem(LS_URL, clean(projectUrl));
    localStorage.setItem(LS_KEY, clean(anonKeyValue));
    window.location.reload();
  } catch {
    // Sin localStorage disponible no se puede configurar manualmente.
  }
}

/** ¿La configuración activa viene del fallback manual (localStorage)? */
export const usingManualSupabaseConfig = Boolean(!envUrl || !envKey) && Boolean(rawUrl);

/** Borra la configuración manual guardada y recarga la app. */
export function clearSupabaseConfig(): void {
  try {
    localStorage.removeItem(LS_URL);
    localStorage.removeItem(LS_KEY);
    window.location.reload();
  } catch {
    // Sin localStorage no hay nada que borrar.
  }
}

/** Normaliza la Project URL: comillas/espacios fuera, https://, sin barra final.
 *  Si se pegó el link del dashboard o una ruta interna del API, la reduce a la
 *  raíz del proyecto: https://<ref>.supabase.co */
function normalizeProjectUrl(raw: string): string {
  let u = clean(raw);
  if (!u) return "";
  // Link del dashboard (https://supabase.com/dashboard/project/<ref>) → ref.
  const dash = u.match(/^https?:\/\/[^/]*supabase\.com\/(?:dashboard\/)?project\/([a-z0-9]+)/i);
  if (dash) return `https://${dash[1]}.supabase.co`;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  // Rutas internas pegadas por error (/rest/v1, /auth/v1, ...).
  u = u.replace(/\/(?:rest|auth|realtime|storage|functions)\/v1$/i, "");
  return u.replace(/\/+$/, "");
}

const url = normalizeProjectUrl(rawUrl);

/** Motivo por el que Supabase no está listo, o null si la configuración es correcta. */
export const supabaseConfigError: string | null =
  !url || !anonKey
    ? `Faltan las claves de Supabase (${[!url && "VITE_SUPABASE_URL", !anonKey && "VITE_SUPABASE_ANON_KEY"]
        .filter(Boolean)
        .join(" y ")}). Pégalas en Keys / API keys — o conéctalas ahora en el panel de aquí abajo.`
    : null;

if (supabaseConfigError) {
  // En preview sin variables, no romper el render: los hooks devolverán error.
  console.warn(`[11Eleven] ${supabaseConfigError}`);
} else {
  console.info(`[11Eleven] Supabase conectado a ${url}`);
}

export const supabase: SupabaseClient = createClient(
  url || "http://localhost:54321",
  anonKey || "missing-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

/** URL efectiva que usa el cliente (para diagnóstico). */
export const supabaseUrl = url || "http://localhost:54321";

/* ------------------------------------------------------------------ *
 * Tipos mínimos del esquema (shape PostgREST camelCase aliasado)
 * ------------------------------------------------------------------ */

export type DbPlayer = {
  id: string;
  name: string;
  position: string;
  group: string;
  ovr: number;
  age: number;
  value: number;
  nationality: string;
  flag: string;
  real_club: string;
  real_league: string;
  fc_version: string;
  photo: string | null;
};

export type DbProfile = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  nickname: string | null;
  active_tournament_id: string | null;
};

export type DbTournament = {
  id: string;
  code: string;
  name: string;
  season: string;
  status: string;
  current_matchday: number;
  total_matchdays: number;
  market_open: boolean;
  owner_user_id: string | null;
  competition_id: string | null;
  next_matchday_at: string | null;
  created_at: string;
};

export type DbRules = {
  tournament_id: string;
  budget: number;
  squad_size: number;
  gk_min: number; gk_max: number;
  def_min: number; def_max: number;
  mid_min: number; mid_max: number;
  fwd_min: number; fwd_max: number;
  max_per_real_club: number;
  min_ovr: number;
  max_u21: number;
  lineup_lock_hours: number;
  fc27_formation_code: string;
  formation_instructions: string;
  u20_min: number;
  u20_in_starting_lineup: "obligatory" | "substitute" | null;
  same_nationality_min: number;
  same_nationality_rule: "obligatory" | "changeable" | null;
  same_nationality_match_duration_minutes: number;
  club_nationality_min: number;
};

export type DbClub = {
  id: string;
  tournament_id: string;
  name: string;
  short_name: string;
  league: string;
  country: string;
  color_primary: string;
  color_secondary: string;
  catalog_team_id: string | null;
};

export type DbPresident = {
  id: string;
  tournament_id: string;
  user_id: string;
  nickname: string;
  display_name: string;
  club_id: string | null;
  budget: number;
  joined_at: string;
};

export type DbSquad = {
  id: string;
  tournament_id: string;
  club_id: string;
  president_id: string;
  formation: string;
  lineup: Array<{ slotId: string; playerId: string | null }>;
  lineup_updated_at: string;
};

export type DbSquadPlayer = {
  id: string;
  tournament_id: string;
  club_id: string;
  squad_id: string;
  player_id: string;
  president_id: string;
  availability: "transferible" | "negociacion" | "neutro" | "intransferible";
  ovr_at_join: number;
  value_at_join: number;
  joined_at: string;
  injured_until_matchday: number | null;
};

export type DbOffer = {
  id: string;
  tournament_id: string;
  type: "cash" | "trade";
  bidder_president_id: string;
  bidder_club_id: string;
  seller_president_id: string | null;
  seller_club_id: string | null;
  requested_player_ids: string[];
  offered_player_ids: string[];
  cash: number;
  message: string | null;
  status:
    | "borrador" | "enviada" | "negociacion" | "aceptada" | "reservada"
    | "ejecutada" | "rechazada" | "cancelada" | "expirada" | "invalidada";
  parent_offer_id: string | null;
  last_validation: string | null;
  invalid_reason: string | null;
  created_at: string;
  updated_at: string;
  agreed_at: string | null;
  executed_at: string | null;
};

export type DbDraft = {
  id: string;
  tournament_id: string;
  status: "borrador" | "en_curso" | "pausado" | "cerrado";
  order: string[];
  current_index: number;
  round: number;
  total_rounds: number;
  pick_seconds: number;
  current_deadline: string | null;
  snake: boolean;
  started_at: string | null;
  closed_at: string | null;
};

export type DbFixture = {
  id: string;
  tournament_id: string;
  matchday: number;
  home_club_id: string;
  away_club_id: string;
  status: "programado" | "en_curso" | "jugado";
  kickoff_at: string;
  home_goals: number | null;
  away_goals: number | null;
  home_points: number | null;
  away_points: number | null;
  home_xi_ovr: number | null;
  away_xi_ovr: number | null;
  played_at: string | null;
};

export type DbAudit = {
  id: string;
  tournament_id: string;
  club_id: string | null;
  actor_user_id: string | null;
  actor_name: string;
  action: string;
  entity: string;
  entity_id: string | null;
  detail: string;
  created_at: string;
};

export type DbLeagueMember = {
  tournament_id: string;
  user_id: string;
  role: string;
  joined_at: string;
};

export type DbTeamCatalog = {
  id: string;
  sofifa_team_id: number | null;
  name: string;
  league: string;
  country: string;
  color_primary: string;
  color_secondary: string;
};

/* ------------------------------------------------------------------ *
 * Auth: sesión y helpers
 * ------------------------------------------------------------------ */

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Ejecuta un RPC security definer y devuelve data o lanza con el mensaje. */
export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/** Ejecuta una lectura y lanza con el mensaje si falla (patrón uniforme). */
export async function select<T>(query: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T | null> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}
