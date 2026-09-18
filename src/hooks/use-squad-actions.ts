import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import type { PlayerAvailability } from "@/convex/rulesEngine";
import { useMutation } from "convex/react";
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
