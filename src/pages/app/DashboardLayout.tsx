import { AppError, AppLoading, AppShell } from "@/components/eleven/AppShell";
import { useEnsureTournament, useTournamentState } from "@/hooks/use-tournament";
import { Outlet } from "react-router";
import ClubSelection from "./ClubSelection";
import LeagueGate from "./LeagueGate";

export default function DashboardLayout() {
  const { state, isLoading } = useTournamentState();
  const { error } = useEnsureTournament(state === null);

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
    return <ClubSelection state={state} />;
  }

  return (
    <AppShell state={state}>
      <Outlet context={state} />
    </AppShell>
  );
}
