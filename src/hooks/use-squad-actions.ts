import { api } from "@/services/backend/api";
import type { Id } from "@/domain/ids";
import { errorMessage } from "@/lib/errors";
import type { PlayerAvailability } from "@/domain/rulesEngine";
import { useMutation } from "@/services/backend/react";
import { useState } from "react";
import { toast } from "sonner";

export function useSquadActions() {
  const setAvailabilityMutation = useMutation(api.squads.setAvailability);
  const [savingAvailability, setSavingAvailability] = useState(false);

  const saveAvailability = async (
    squadPlayerId: Id<"squadPlayers">,
    availability: PlayerAvailability,
    playerName: string,
  ) => {
    setSavingAvailability(true);
    try {
      await setAvailabilityMutation({ squadPlayerId, availability });
      toast.success("Situación actualizada", {
        description: `${playerName} ahora figura como ${availability}.`,
      });
      return true;
    } catch (cause) {
      toast.error("No se pudo actualizar la situación", {
        description: errorMessage(cause),
      });
      return false;
    } finally {
      setSavingAvailability(false);
    }
  };

  return { saveAvailability, savingAvailability };
}
