import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/lib/errors";
import { AppError, AppLoading, AppShell } from "@/components/eleven/AppShell";
import { useEnsureTournament, useTournamentState } from "@/hooks/use-tournament";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Outlet, useLocation, useSearchParams } from "react-router";
import ClubSelection from "./ClubSelection";
import LeagueGate from "./LeagueGate";
export default function DashboardLayout() {
    const { state, isLoading } = useTournamentState();
    const { error } = useEnsureTournament(state === null);
    const location = useLocation();
    const joinLeague = useMutation(api.leagues.joinLeague);
    // Shared invitation link: /dashboard?invitar=CODE — accepted here so the
    // link works for new and existing members alike (RequireAuth preserves the
    // query string when it bounces through /auth).
    const [searchParams, setSearchParams] = useSearchParams();
    const inviteCode = searchParams.get("invitar")?.trim().toUpperCase() ?? null;
    const consumedInvite = useRef(null);
    useEffect(() => {
        if (!inviteCode || consumedInvite.current === inviteCode)
            return;
        if (isLoading || !state)
            return;
        consumedInvite.current = inviteCode;
        const next = new URLSearchParams(searchParams);
        next.delete("invitar");
        joinLeague({ code: inviteCode })
            .then((result) => {
            toast.success(`Te uniste a ${result.name}`, {
                description: "Invitación aceptada: ya puedes elegir el equipo que vas a presidir.",
            });
        })
            .catch((cause) => {
            toast.error("No se pudo aceptar la invitación", {
                description: errorMessage(cause),
            });
        })
            .finally(() => setSearchParams(next, { replace: true }));
    }, [
        inviteCode,
        isLoading,
        state,
        joinLeague,
        searchParams,
        setSearchParams,
    ]);
    if (error) {
        return (_jsx(AppError, { title: "No se pudo inicializar la aplicaci\u00F3n", description: error }));
    }
    if (isLoading || state === null || state === undefined) {
        return _jsx(AppLoading, {});
    }
    // Without a league the create/join gate replaces the whole control room.
    if (state.needsLeague) {
        return _jsx(LeagueGate, { state: state });
    }
    if (state.needsClub) {
        // Administration stays reachable while the Administrator still owes the
        // club-selection step: the "Omitir elección y configurar reglas primero"
        // button lands on /dashboard/admin, and without this bypass the layout
        // kept re-rendering ClubSelection forever (rules were unreachable).
        const onAdminRoute = location.pathname
            .replace(/\/+$/, "")
            .endsWith("/dashboard/admin");
        if (!(state.isAdmin && onAdminRoute)) {
            return _jsx(ClubSelection, { state: state });
        }
    }
    return (_jsx(AppShell, { state: state, children: _jsx(Outlet, { context: state }) }));
}
