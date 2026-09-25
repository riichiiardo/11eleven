import { AppError, AppLoading, AppShell } from "@/components/eleven/AppShell";
import { useEnsureTournament, useTournamentState } from "@/hooks/use-tournament";
import { Outlet, useLocation } from "react-router";
import ClubSelection from "./ClubSelection";
import LeagueGate from "./LeagueGate";

export default function DashboardLayout() {
  const { state, isLoading } = useTournamentState();
  const { error } = useEnsureTournament(state === null);
  const location = useLocation();

  if (error) {
    return (
      <AppError
        title="No se pudo inicializar la aplicación"
        description={error}
      />
    );
  }

  if (isLoading || state === null || state === undefined) {
    return <AppLoading />;
  }

  // Without a league the create/join gate replaces the whole control room.
  if (state.needsLeague) {
    return <LeagueGate state={state} />;
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
      return <ClubSelection state={state} />;
    }
  }

  return (
    <AppShell state={state}>
      <Outlet context={state} />
    </AppShell>
  );
}
