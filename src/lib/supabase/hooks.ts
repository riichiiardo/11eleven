import { useCallback, useEffect, useRef, useState } from "react";
import { rpc, supabase } from "@/lib/supabase/client";

/**
 * 11Eleven — hooks de datos equivalentes a los de Convex.
 *
 * Paridad de firma con `useQuery(api.x.y, args)` / `useMutation(api.x.y)`:
 *
 *   const data = useQuery("market.browse", { scope: "todos" });
 *   const mutate = useMutation(); await mutate("market.createOffer", {...});
 *
 * - `undefined` = cargando, `null` = sin datos (igual que en Convex).
 * - Las lecturas son reactivas vía polling suave (los usuarios del mismo
 *   torneo ven cambios de otros en unos segundos sin websockets).
 * - Las escrituras siempre por RPC security definer y refrescan el cache.
 */

const REFRESH_MS = 15_000;

const cache = new Map<string, { at: number; value: unknown }>();
const inFlight = new Map<string, Promise<unknown>>();
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

export function invalidateAll() {
  cache.clear();
  notify();
}

/** Convierte una key "a.b" de la era Convex al RPC/tabla equivalente. */
function resolve(key: string): { kind: "rpc" | "table"; name: string } | null {
  const map: Record<string, { kind: "rpc" | "table"; name: string }> = {
    "tournament.state": { kind: "rpc", name: "tournament_state" },
    "tournament.adminOverview": { kind: "rpc", name: "admin_overview" },
    "market.browse": { kind: "rpc", name: "market_browse" },
    "market.overview": { kind: "rpc", name: "market_overview" },
    "draft.check": { kind: "rpc", name: "draft_check" },
    "draft.control": { kind: "rpc", name: "draft_control" },
    "draft.pool": { kind: "rpc", name: "draft_pool" },
    "teams.squadOf": { kind: "rpc", name: "team_squad" },
    "footballSync.catalogState": { kind: "rpc", name: "catalog_state" },
    "users.currentUser": { kind: "table", name: "profiles" },
  };
  return map[key] ?? null;
}

async function runQuery<T>(key: string, args: Record<string, unknown> | undefined): Promise<T | null> {
  const r = resolve(key);
  if (!r) return Promise.reject(new Error(`Lectura no soportada aún: ${key}`));

  if (r.kind === "rpc") {
    return supabase
      .rpc(r.name, (args ?? {}) as Record<string, unknown>)
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data ?? null) as T | null;
      });
  }
  // users.currentUser → fila de profiles del usuario actual
  return supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) return null;
    return supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data ?? null) as T | null;
      });
  });
}

export function useQuery<T = unknown>(
  key: string,
  args?: Record<string, unknown>,
  options?: { refreshMs?: number; enabled?: boolean },
): T | undefined | null {
  const { refreshMs = REFRESH_MS, enabled = true } = options ?? {};
  const cacheKey = `${key}:${JSON.stringify(args ?? {})}`;
  const cached = cache.get(cacheKey);
  const [value, setValue] = useState<unknown>(cached?.value);
  const errorRef = useRef<Error | null>(null);

  const load = useCallback(
    async (force: boolean) => {
      if (!enabled) return;
      if (!force && cached && Date.now() - cached.at < refreshMs) return;
      const existing = inFlight.get(cacheKey);
      if (existing) return existing;
      const p = runQuery<T>(key, args)
        .then((data) => {
          cache.set(cacheKey, { at: Date.now(), value: data });
          inFlight.delete(cacheKey);
          notify();
          return data;
        })
        .catch((cause: unknown) => {
          inFlight.delete(cacheKey);
          errorRef.current = cause instanceof Error ? cause : new Error(String(cause));
          throw cause;
        });
      inFlight.set(cacheKey, p);
      try {
        await p;
      } catch {
        // el estado de error se expone vía console; la UI muestra el estado previo
        console.warn(`[11Eleven] Lectura fallida (${key}):`, errorRef.current?.message);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cacheKey, enabled, key, refreshMs, JSON.stringify(args ?? {})],
  );

  useEffect(() => {
    void load(false);
    const listener = () => void load(false);
    listeners.add(listener);
    const timer = window.setInterval(() => void load(true), refreshMs);
    return () => {
      listeners.delete(listener);
      window.clearInterval(timer);
    };
  }, [load, refreshMs]);

  const fresh = cache.get(cacheKey);
  return (fresh?.value ?? undefined) as T | undefined | null;
}

/** useMutation: ejecuta un RPC y refresca el cache global al terminar. */
export function useMutation() {
  return useCallback(async (key: string, args: Record<string, unknown> = {}) => {
    const { error } = await supabase.rpc(key, args);
    if (error) throw new Error(error.message);
    invalidateAll();
  }, []);
}

/* ------------------------------------------------------------------ *
 * Acciones de alto nivel (paridad con los hooks use-*-actions previos)
 * ------------------------------------------------------------------ */

export const tournament = {
  ensureSetup: () => rpc("ensure_setup"),
  createLeague: (name: string, season: string, code?: string) =>
    rpc<string>("create_league", { p_name: name, p_season: season, p_code: code }),
  joinLeague: (code: string) => rpc<string>("join_league", { p_code: code }),
  activateLeague: (tournamentId: string) =>
    rpc("activate_league", { p_tournament_id: tournamentId }),
  chooseCatalogTeam: (teamCatalogId: string) =>
    rpc<string>("choose_catalog_team", { p_team_catalog_id: teamCatalogId }),
  updateProfile: (name: string, nickname: string, image?: string | null) =>
    rpc("update_profile", { p_name: name, p_nickname: nickname, p_image: image }),
  updateRules: (rules: Record<string, unknown>) => rpc("update_rules", { p_rules: rules }),
  setTournamentStatus: (status: string) => rpc("set_tournament_status", { p_status: status }),
  setCompetition: (competitionId: string) => rpc("set_competition", { p_competition_id: competitionId }),
  setPrizes: (prizes: unknown[]) => rpc("set_prizes", { p_prizes: prizes }),
  grantAdmin: (userId: string, role: string) => rpc("grant_admin", { p_user_id: userId, p_role: role }),
  revokeAdmin: (userId: string) => rpc("revoke_admin", { p_user_id: userId }),
  grantBudget: (presidentId: string, amount: number, concept: string) =>
    rpc("grant_budget", { p_president_id: presidentId, p_amount: amount, p_concept: concept }),
};

export const market = {
  createOffer: (payload: {
    type: string;
    requested: string[];
    offered: string[];
    cash: number;
    message?: string | null;
  }) =>
    rpc<string>("create_offer", {
      p_type: payload.type,
      p_requested: payload.requested,
      p_offered: payload.offered,
      p_cash: payload.cash,
      p_message: payload.message,
    }),
  respondOffer: (offerId: string, action: "aceptar" | "rechazar" | "negociar" | "cancelar") =>
    rpc("respond_offer", { p_offer_id: offerId, p_action: action }),
};

export const draft = {
  prepare: (totalRounds?: number, pickSeconds?: number, snake?: boolean) =>
    rpc("draft_prepare", { p_total_rounds: totalRounds, p_pick_seconds: pickSeconds, p_snake: snake ?? false }),
  setStatus: (status: "en_curso" | "pausado" | "cerrado") =>
    rpc("draft_set_status", { p_status: status }),
  skipTurn: () => rpc("draft_skip_turn"),
  pick: (playerId: string) => rpc("draft_pick", { p_player_id: playerId }),
};

export const squads = {
  setAvailability: (squadPlayerId: string, availability: string) =>
    rpc("set_availability", { p_squad_player_id: squadPlayerId, p_availability: availability }),
  saveLineup: (formation: string, slots: Array<{ slotId: string; playerId: string | null }>) =>
    rpc("save_lineup", { p_formation: formation, p_slots: slots }),
  autoFillLineup: async (
    formation: string,
    squad: Array<{ playerId: string; position: string; ovr: number }>,
    slots: Array<{ slotId: string; accepts: string[] }>,
  ) => {
    // El solver vive en el cliente (rulesEngine): se calcula local y se guarda.
    const used = new Set<string>();
    const assignment = new Map<string, string>();
    const pending = [...slots];
    while (pending.length > 0) {
      let best: { slot: (typeof slots)[number]; player: (typeof squad)[number] } | null = null;
      let bestScarcity = Number.POSITIVE_INFINITY;
      for (const slot of pending) {
        const candidates = squad.filter((p) => !used.has(p.playerId) && slot.accepts.includes(p.position));
        if (candidates.length === 0 || candidates.length >= bestScarcity) continue;
        bestScarcity = candidates.length;
        best = { slot, player: [...candidates].sort((a, b) => b.ovr - a.ovr)[0]! };
      }
      if (!best) break;
      used.add(best.player.playerId);
      assignment.set(best.slot.slotId, best.player.playerId);
      pending.splice(pending.indexOf(best.slot), 1);
    }
    const filled = slots.map((s) => ({ slotId: s.slotId, playerId: assignment.get(s.slotId) ?? null }));
    await rpc("save_lineup", { p_formation: formation, p_slots: filled });
    return filled;
  },
};

export const competition = {
  generateCalendar: () => rpc<number>("generate_calendar"),
  closeMatchday: () => rpc("close_matchday"),
  reportFixture: (payload: {
    fixtureId: string;
    homeGoals: number;
    awayGoals: number;
    goals?: unknown[];
    yellow?: unknown[];
    red?: unknown[];
    injuries?: unknown[];
  }) =>
    rpc("report_fixture", {
      p_fixture_id: payload.fixtureId,
      p_home_goals: payload.homeGoals,
      p_away_goals: payload.awayGoals,
      p_goals: payload.goals ?? [],
      p_yellow: payload.yellow ?? [],
      p_red: payload.red ?? [],
      p_injuries: payload.injuries ?? [],
    }),
  syncCompetition: () => rpc("close_matchday"),
};

export const catalog = {
  syncFromStaging: (limit = 1000, offset = 0) =>
    rpc<{ applied: number; nextOffset: number; total: number; done: boolean }>(
      "sync_catalog_from_staging",
      { p_limit: limit, p_offset: offset },
    ),
};
