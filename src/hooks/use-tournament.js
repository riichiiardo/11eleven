import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
/** Ticking clock for the deadline center (lineup lock, next matchday). */
export function useNow(intervalMs = 1000) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), intervalMs);
        return () => window.clearInterval(id);
    }, [intervalMs]);
    return now;
}
/**
 * The control-room query. `undefined` means loading, `null` means the
 * bootstrap has not run yet (see useEnsureTournament).
 */
export function useTournamentState() {
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
export function useEnsureTournament(ready) {
    const ensureSetup = useMutation(api.tournament.ensureSetup);
    const [error, setError] = useState(null);
    const started = useRef(false);
    useEffect(() => {
        if (!ready || started.current)
            return;
        started.current = true;
        ensureSetup().catch((cause) => {
            setError(cause instanceof Error
                ? cause.message
                : "No se pudo inicializar la aplicación.");
        });
    }, [ready, ensureSetup]);
    return { error };
}
