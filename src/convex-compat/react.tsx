/**
 * 11Eleven — capa de compatibilidad: `convex/react` shim.
 *
 * Reimplementa los hooks de Convex sobre Supabase. El mapeo de lecturas y
 * mutaciones vive en la función resolve; las páginas no cambian.
 */
import {
  adaptDraft,
  adaptMarketOverview,
  adaptTournamentState,
} from "@/lib/supabase/adapters";
import {
  rpc,
  supabase,
  supabaseConfigError,
  supabaseUrl,
} from "@/lib/supabase/client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** Envuelve fallos de red en un mensaje accionable con la URL real usada. */
function throwNetwork(cause: unknown): never {
  if (cause instanceof TypeError && /fetch/i.test(cause.message)) {
    throw new Error(
      `No se pudo conectar con Supabase (${supabaseUrl}). Comprueba tu conexión o que la URL del proyecto sea correcta.`,
    );
  }
  throw cause;
}

/* ------------------------------------------------------------------ *
 * Auth context (reemplaza @convex-dev/auth/react)
 * ------------------------------------------------------------------ */

export type CompatUser = {
  id: string;
  name: string;
  email: string;
  nickname: string;
  image: string | null;
};

type AuthValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: CompatUser | null;
  signIn: (credentials: { email: string; password?: string }) => Promise<void>;
  signUp: (credentials: { email: string; password: string }) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  isRecovery: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function ConvexAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{
    user?: { id: string; email?: string };
  } | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(
        data.session as unknown as {
          user?: { id: string; email?: string };
        } | null,
      );
      setIsLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(
        s as unknown as { user?: { id: string; email?: string } } | null,
      );
      setIsRecovery(event === "PASSWORD_RECOVERY");
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const uid = session?.user?.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setProfile((data as Record<string, unknown>) ?? null);
      });
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const value = useMemo<AuthValue>(() => {
    const u = session?.user;
    return {
      isLoading,
      isAuthenticated: Boolean(session),
      user: u
        ? {
            id: u.id,
            name:
              (profile?.name as string) ?? u.email?.split("@")[0] ?? "Usuario",
            email: u.email ?? "",
            nickname:
              (profile?.nickname as string) ??
              (profile?.name as string) ??
              u.email?.split("@")[0] ??
              "Presidente",
            image: (profile?.image as string) ?? null,
          }
        : null,
      signIn: async ({ email, password }) => {
        if (supabaseConfigError) throw new Error(supabaseConfigError);
        if (!password) throw new Error("Escribe tu contraseña para continuar.");
        const { error } = await supabase.auth
          .signInWithPassword({ email, password })
          .catch(throwNetwork);
        if (error) throw new Error(error.message);
      },
      signUp: async ({ email, password }) => {
        if (supabaseConfigError) throw new Error(supabaseConfigError);
        const { error } = await supabase.auth
          .signUp({ email, password })
          .catch(throwNetwork);
        if (error) throw new Error(error.message);
      },
      requestPasswordReset: async (email) => {
        if (supabaseConfigError) throw new Error(supabaseConfigError);
        const { error } = await supabase.auth
          .resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth`,
          })
          .catch(throwNetwork);
        if (error) throw new Error(error.message);
      },
      updatePassword: async (password) => {
        if (supabaseConfigError) throw new Error(supabaseConfigError);
        const { error } = await supabase.auth
          .updateUser({ password })
          .catch(throwNetwork);
        if (error) throw new Error(error.message);
      },
      isRecovery,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    };
  }, [session, profile, isLoading, isRecovery]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useConvexAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx)
    throw new Error(
      "useConvexAuth debe usarse dentro de <ConvexAuthProvider>.",
    );
  return { isLoading: ctx.isLoading, isAuthenticated: ctx.isAuthenticated };
}

export function useAuthActions() {
  const ctx = useContext(AuthContext);
  if (!ctx)
    throw new Error(
      "useAuthActions debe usarse dentro de <ConvexAuthProvider>.",
    );
  return {
    signIn: ctx.signIn,
    signUp: ctx.signUp,
    requestPasswordReset: ctx.requestPasswordReset,
    updatePassword: ctx.updatePassword,
    isRecovery: ctx.isRecovery,
    signOut: ctx.signOut,
  };
}

/* ------------------------------------------------------------------ *
 * useQuery / useMutation
 * ------------------------------------------------------------------ */

const REFRESH_MS = 15_000;
const cache = new Map<string, unknown>();
const timers = new Map<string, number>();

/** Mapeo lectura Convex → RPC/tabla Supabase. */
function resolveRead(
  ref: string,
  args: Record<string, unknown> | undefined,
): Promise<unknown> {
  switch (ref) {
    case "users.currentUser": {
      return supabase.auth.getUser().then(({ data }) => {
        if (!data.user) return null;
        return supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .maybeSingle()
          .then(({ data: row }) => row ?? null);
      });
    }
    case "tournament.state":
      return rpc<Record<string, unknown> | null>("tournament_state").then(
        adaptTournamentState,
      );
    case "market.browse":
      return rpc<Record<string, unknown>>("market_browse", {
        p_scope: args?.scope ?? "todos",
        p_sort: args?.sort ?? "ovr",
        p_only_affordable: args?.onlyAffordable ?? false,
        p_limit: args?.limit ?? 24,
        p_offset: args?.offset ?? 0,
      });
    case "market.overview":
      return rpc<Record<string, unknown> | null>("market_overview").then(
        adaptMarketOverview,
      );
    case "draft.check":
    case "draft.control":
      return rpc<Record<string, unknown> | null>("draft_check").then(
        adaptDraft,
      );
    case "draft.pool":
      return rpc<Record<string, unknown>>("draft_pool", {
        p_position: args?.position ?? null,
        p_search: args?.search ?? null,
        p_limit: args?.limit ?? 50,
        p_offset: args?.offset ?? 0,
      });
    case "teams.squadOf":
      return rpc<Record<string, unknown> | null>("team_squad", {
        p_club_id: args?.clubId,
      });
    case "footballSync.catalogState":
      return rpc<Record<string, unknown>>("catalog_state");
    case "tournament.adminOverview":
      return rpc<Record<string, unknown>>("admin_overview");
    case "market.validateOffer":
    case "market.guidance":
      return Promise.resolve(null);
    default:
      return Promise.reject(new Error(`Lectura no soportada: ${ref}`));
  }
}

function refOf(fnRef: unknown): string {
  const r = fnRef as { __ref?: string } | string;
  return typeof r === "string" ? r : (r.__ref ?? String(r));
}

export function useQuery<T = unknown>(
  fnRef: unknown,
  args?: Record<string, unknown>,
): T | undefined | null {
  // OJO: los hooks van SIEMPRE primero (reglas de React). El guard de
  // configuración vive dentro de `load`, no como early-return.
  const ref = refOf(fnRef);
  const key = `${ref}:${JSON.stringify(args ?? {})}`;
  const [value, setValue] = useState<unknown>(() => cache.get(key));
  const [tick, setTick] = useState(0);

  const load = useCallback(
    async (force: boolean) => {
      if (supabaseConfigError) {
        console.warn(
          `[11Eleven] useQuery(${ref}) sin ejecutar: ${supabaseConfigError}`,
        );
        return;
      }
      if (timers.has(key)) return;
      if (!force && cache.has(key)) {
        const at = (cache.get(`${key}:at`) as number) ?? 0;
        if (Date.now() - at < REFRESH_MS) return;
      }
      const timer = window.setTimeout(async () => {
        timers.delete(key);
        try {
          const data = await resolveRead(ref, args);
          cache.set(key, data);
          cache.set(`${key}:at`, Date.now());
          setTick((t) => t + 1);
        } catch (cause) {
          const message =
            cause instanceof Error ? cause.message : String(cause);
          console.warn(`[11Eleven] ${ref}: ${message}`);
          if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
            console.warn(
              `[11Eleven] URL en uso: ${supabaseUrl}. ¿Es correcta la Project URL de Supabase y tienes internet?`,
            );
          }
        }
      }, 10);
      timers.set(key, timer);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, ref, JSON.stringify(args ?? {})],
  );

  useEffect(() => {
    void load(false);
    const interval = window.setInterval(() => void load(true), REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [load]);

  // Re-render cuando el cache cambia (cualquier mutación o refresco).
  useEffect(() => {
    const next = cache.get(key);
    if (next !== undefined && next !== value) setValue(next);
  }, [tick, key, value]);

  return (cache.has(key) ? cache.get(key) : undefined) as T | undefined | null;
}

/** useMutation: ejecuta un RPC security definer y refresca los caches.
 *  Soporta las dos firmas que usan las páginas:
 *    · Estilo con ref explícito:  const m = useMutation();  m(api.leagues.createLeague, { name })
 *    · Estilo Convex (ref en el hook): const m = useMutation(api.leagues.createLeague); m({ name })
 */
export function useMutation(hookRef?: unknown) {
  const hookRefStr = hookRef === undefined ? undefined : refOf(hookRef);
  return useCallback(
    async (a?: unknown, b: Record<string, unknown> = {}) => {
      if (supabaseConfigError) throw new Error(supabaseConfigError);
      let ref: string;
      let args: Record<string, unknown>;
      const looksLikeRef =
        typeof a === "string" ||
        (a !== null && typeof a === "object" && "__ref" in (a as object));
      if (looksLikeRef) {
        ref = refOf(a);
        args = b;
      } else if (hookRefStr) {
        ref = hookRefStr;
        args = (a as Record<string, unknown>) ?? {};
      } else {
        throw new Error(
          "Mutación sin referencia: usa mut(api.mod.fn, args) o crea el hook con mut(api.mod.fn).",
        );
      }
      const fn = resolveMutation(ref);
      try {
        const result = await fn(args);
        cache.clear(); // invalidate-all: las lecturas se refrescan al siguiente tick
        return result;
      } catch (cause) {
        throwNetwork(cause);
      }
    },
    [hookRefStr],
  );
}

/** Actions use the same Supabase RPC bridge as mutations in the compatibility layer. */
export const useAction = useMutation;

function resolveMutation(
  ref: string,
): (args: Record<string, unknown>) => Promise<unknown> {
  const map: Record<string, (a: Record<string, unknown>) => Promise<unknown>> =
    {
      "tournament.ensureSetup": () => rpc("ensure_setup"),
      "tournament.grantAdmin": (a) =>
        rpc("grant_admin", {
          p_user_id: a.userId,
          p_role: a.role ?? "coAdmin",
        }),
      "tournament.revokeAdmin": (a) =>
        rpc("revoke_admin", { p_user_id: a.userId }),
      "tournament.setTournamentStatus": (a) =>
        rpc("set_tournament_status", { p_status: a.status }),
      "tournament.updateRules": (a) =>
        rpc("update_rules", { p_rules: a.rules }),
      "tournament.chooseCatalogTeam": (a) =>
        rpc("choose_catalog_team", { p_team_catalog_id: a.catalogTeamId }),
      "tournament.ensureTeamCatalog": () => rpc<number>("ensure_team_catalog"),
      "tournament.updateProfile": (a) =>
        rpc("update_profile", {
          p_name: a.name ?? "",
          p_nickname: a.nickname ?? "",
          p_image: a.image ?? null,
        }),
      "tournament.updateAvatar": (a) =>
        rpc("update_profile", { p_name: "", p_nickname: "", p_image: a.image }),
      "leagues.createLeague": async (a) => {
        const tid = await rpc<string>("create_league", {
          p_name: a.name,
          p_season: a.season ?? String(new Date().getFullYear() + 1),
          p_code: a.code,
        });
        // La página espera { name } como en Convex; la RPC devuelve solo el uuid.
        return { id: tid, name: a.name };
      },
      "leagues.joinLeague": async (a) => {
        const tid = await rpc<string>("join_league", { p_code: a.code });
        return { id: tid, name: a.code };
      },
      "leagues.activateLeague": (a) =>
        rpc("activate_league", { p_tournament_id: a.tournamentId }),
      "squads.setAvailability": (a) =>
        rpc("set_availability", {
          p_squad_player_id: a.squadPlayerId,
          p_availability: a.availability,
        }),
      "squads.saveLineup": (a) =>
        rpc("save_lineup", { p_formation: a.formation, p_slots: a.slots }),
      "squads.autoFillLineup": async (a) => {
        // El solver vive en el cliente; guarda el XI calculado con los slots del squad.
        const slots = (a.slots ?? []) as Array<{
          slotId: string;
          accepts?: string[];
          label?: string;
        }>;
        const squad = (a.squad ?? []) as Array<{
          playerId: string;
          position: string;
          ovr: number;
        }>;
        const used = new Set<string>();
        const assignment = new Map<string, string>();
        const pending = [...slots];
        while (pending.length > 0) {
          let best: {
            slot: (typeof slots)[number];
            player: (typeof squad)[number];
          } | null = null;
          let bestScarcity = Number.POSITIVE_INFINITY;
          for (const slot of pending) {
            const accepts = slot.accepts ?? (slot.label ? [slot.label] : []);
            const candidates = squad.filter(
              (p) => !used.has(p.playerId) && accepts.includes(p.position),
            );
            if (candidates.length === 0 || candidates.length >= bestScarcity)
              continue;
            bestScarcity = candidates.length;
            best = {
              slot,
              player: [...candidates].sort((x, y) => y.ovr - x.ovr)[0]!,
            };
          }
          if (!best) break;
          used.add(best.player.playerId);
          assignment.set(best.slot.slotId, best.player.playerId);
          pending.splice(pending.indexOf(best.slot), 1);
        }
        const filled = slots.map((s) => ({
          slotId: s.slotId,
          playerId: assignment.get(s.slotId) ?? null,
        }));
        await rpc("save_lineup", { p_formation: a.formation, p_slots: filled });
        return { lineup: filled };
      },
      "market.createOffer": (a) =>
        rpc<string>("create_offer", {
          p_type:
            a.type ??
            (Array.isArray(a.offeredPlayerIds) && a.offeredPlayerIds.length > 0
              ? "trade"
              : "cash"),
          p_requested: a.requestedPlayerIds ?? [],
          p_offered: a.offeredPlayerIds ?? [],
          p_cash: a.cash ?? 0,
          p_message: a.message ?? null,
        }),
      "market.respondOffer": (a) =>
        rpc("respond_offer", { p_offer_id: a.offerId, p_action: a.action }),
      "market.cancelOffer": (a) =>
        rpc("respond_offer", { p_offer_id: a.offerId, p_action: "cancelar" }),
      "market.executeReserved": () => rpc("respond_offer_execute_reserved"),
      "draft.prepare": (a) =>
        rpc("draft_prepare", {
          p_total_rounds: a.totalRounds,
          p_pick_seconds: a.pickSeconds,
          p_snake: a.snake,
        }),
      "draft.open": () => rpc("draft_set_status", { p_status: "en_curso" }),
      "draft.pause": () => rpc("draft_set_status", { p_status: "pausado" }),
      "draft.resume": () => rpc("draft_set_status", { p_status: "en_curso" }),
      "draft.close": () => rpc("draft_set_status", { p_status: "cerrado" }),
      "draft.skipTurn": () => rpc("draft_skip_turn"),
      "draft.pick": (a) => rpc("draft_pick", { p_player_id: a.playerId }),
      "adminOps.setPrizes": (a) => rpc("set_prizes", { p_prizes: a.prizes }),
      "adminOps.grantBudget": (a) =>
        rpc("grant_budget", {
          p_president_id: a.presidentId,
          p_amount: a.amount,
          p_concept: a.concept,
        }),
      "adminOps.changePresidentClub": (a) =>
        rpc("change_president_club", {
          p_president_id: a.presidentId,
          p_team_catalog_id: a.teamCatalogId,
          p_league_club_id: a.leagueClubId,
        }),
      "adminOps.removePresident": (a) =>
        rpc("remove_president", { p_president_id: a.presidentId }),
      "adminOps.resetLeague": () => rpc("reset_league"),
      "adminOps.setCompetition": (a) =>
        rpc("set_competition", { p_competition_id: a.competitionId }),
      "adminOps.reportFixture": (a) =>
        rpc("report_fixture", {
          p_fixture_id: a.fixtureId,
          p_home_goals: a.homeGoals,
          p_away_goals: a.awayGoals,
          p_goals: a.goals ?? [],
          p_yellow: a.yellowCards ?? [],
          p_red: a.redCards ?? [],
          p_injuries: a.injuries ?? [],
        }),
      "adminOps.fixtureReport": (a) =>
        rpc("report_fixture", {
          p_fixture_id: a.fixtureId,
          p_home_goals: a.homeGoals,
          p_away_goals: a.awayGoals,
          p_goals: a.goals ?? [],
          p_yellow: a.yellowCards ?? [],
          p_red: a.redCards ?? [],
          p_injuries: a.injuries ?? [],
        }),
      "competition.closeMatchday": () => rpc("close_matchday"),
      "competition.syncCompetition": () => rpc("generate_calendar"),
      "footballApi.syncCatalog": async (a) => {
        let offset = a.page ?? 0;
        let applied = 0;
        let done = false;
        let guard = 0;
        while (!done && guard < 30) {
          guard += 1;
          const res = await rpc<{
            applied: number;
            nextOffset: number;
            done: boolean;
          }>("sync_catalog_from_staging", { p_limit: 1000, p_offset: offset });
          applied += res.applied;
          offset = res.nextOffset;
          done = res.done;
        }
        return {
          fetched: applied,
          inserted: applied,
          updated: 0,
          unchanged: 0,
          done: true,
          page: offset,
          totalPages: 0,
          fallback: false,
          note: null,
          source: "Supabase (SoFIFA)",
        };
      },
    };
  const fn = map[ref];
  if (!fn) {
    return async () => {
      throw new Error(`Mutación no soportada: ${ref}`);
    };
  }
  return fn;
}
