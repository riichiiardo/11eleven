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
    playerId: Id<"players">,
    availability: PlayerAvailability,
    playerName: string,
  ) => {
    setSavingAvailability(true);
    try {
      await setAvailabilityMutation({ playerId, availability });
      toast.success("Situación actualizada", {
        description: `${playerName} ahora figura como ${availability}.`,
      });
    } catch (cause) {
      toast.error("No se pudo actualizar la situación", {
        description: errorMessage(cause),
      });
    } finally {
      setSavingAvailability(false);
    }
  };

  return { saveAvailability, savingAvailability };
}
