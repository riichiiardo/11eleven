import { api } from "@/convex/_generated/api";
import type { AppStateView, NeedsLeagueState } from "@/convex/appTypes";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";

/** Ticking clock for the deadline center (lineup lock, next matchday). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export type DashboardState = AppStateView | NeedsLeagueState;

/**
 * The control-room query. `undefined` means loading, `null` means the
 * bootstrap has not run yet (see useEnsureTournament).
 */
export function useTournamentState(): {
  state: DashboardState | undefined | null;
  isLoading: boolean;
  isFullState: boolean;
} {
  const state = useQuery(api.tournament.state);
  return {
    state,
    isLoading: state === undefined,
    isFullState: state !== undefined && state !== null && !state.needsLeague,
  };
}

/**
 * Idempotent bootstrap: migrates pre-multi-league deployments (membership +
 * active pointer) and returns `needsLeague` for brand new users, whose UI is
 * the create/join gate.
 */
export function useEnsureTournament(ready: boolean) {
  const ensureSetup = useMutation(api.tournament.ensureSetup);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    ensureSetup().catch((cause: unknown) => {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo inicializar la aplicación.",
      );
    });
  }, [ready, ensureSetup]);

  return { error };
}
