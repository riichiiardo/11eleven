import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/lib/errors";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Admin-side competition actions. Closing a matchday is irreversible by
 * design — the engine resolves results, activates the next jornada and writes
 * the audit trail in one atomic mutation — so the hook confirms intent first.
 */
export function useCompetitionActions() {
  const syncMutation = useMutation(api.competition.syncCompetition);
  const closeMutation = useMutation(api.competition.closeMatchday);
  const [busy, setBusy] = useState(false);

  const sync = async (): Promise<boolean> => {
    setBusy(true);
    try {
      const result = await syncMutation({});
      if (result.seeded === 0 && result.activated === 0) {
        toast.info("El calendario ya estaba sincronizado.");
      } else {
        toast.success("Calendario sincronizado", {
          description: `${result.seeded} partido(s) generado(s), ${result.activated} jornada(s) activada(s).`,
        });
      }
      return true;
    } catch (cause) {
      toast.error("No se pudo sincronizar el calendario", {
        description: errorMessage(cause),
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const closeMatchday = async (matchday: number): Promise<boolean> => {
    setBusy(true);
    try {
      const result = await closeMutation({});
      toast.success(`Jornada ${result.closedMatchday} cerrada`, {
        description: `${result.played} partido(s) resueltos${
          result.nextMatchday ? ` · la jornada ${result.nextMatchday} está en curso` : " · el calendario llegó a su fin"
        }.`,
      });
      return true;
    } catch (cause) {
      toast.error(`No se pudo cerrar la jornada ${matchday}`, {
        description: errorMessage(cause),
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { sync, closeMatchday, busy };
}
