import { AppError, AppLoading, AppShell } from "@/components/eleven/AppShell";
import { useEnsureTournament, useTournamentState } from "@/hooks/use-tournament";
import { Outlet } from "react-router";
import ClubSelection from "./ClubSelection";

export default function DashboardLayout() {
  const { state, isLoading } = useTournamentState();
  const { error } = useEnsureTournament(state === null);

  if (error) {
    return (
      <AppError
        title="No se pudo inicializar el torneo"
        description={error}
      />
    );
  }

  if (isLoading || state === null || state === undefined) {
    return <AppLoading />;
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
