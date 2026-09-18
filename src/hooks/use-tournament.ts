import { api } from "@/convex/_generated/api";
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

/**
 * The control-room query. `undefined` means loading, `null` means the
 * tournament has not been bootstrapped yet (see useEnsureTournament).
 */
export function useTournamentState() {
  const state = useQuery(api.tournament.state);
  return { state, isLoading: state === undefined };
}

/**
 * Idempotent bootstrap: creates the tournament, the versioned FC 27 player
 * catalogue and grants the first account the Administrador principal role.
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
          : "No se pudo inicializar el torneo.",
      );
    });
  }, [ready, ensureSetup]);

  return { error };
}
