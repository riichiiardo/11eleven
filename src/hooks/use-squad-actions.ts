import { api } from "@/services/backend/api";
import type { Id } from "@/domain/ids";
import { errorMessage } from "@/lib/errors";
import type { PlayerAvailability } from "@/domain/rulesEngine";
import { useMutation } from "@/services/backend/react";
import { useState } from "react";
import { toast } from "sonner";

export type AvailabilityChange = {
  squadPlayerId: Id<"squadPlayers">;
  availability: PlayerAvailability;
  playerName: string;
};

export type SaleSelection = { squadPlayerId: Id<"squadPlayers">; playerName: string };

export function useSquadActions() {
  const [pendingSale, setPendingSale] = useState<SaleSelection | null>(null);
  const setAvailabilityMutation = useMutation(api.squads.setAvailability);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [pendingAvailability, setPendingAvailability] =
    useState<AvailabilityChange | null>(null);

  const saveAvailability = async (
    squadPlayerId: Id<"squadPlayers">,
    availability: PlayerAvailability,
    playerName: string,
    withdrawFromDraft = false,
  ) => {
    if (availability === "vendido") { setPendingSale({ squadPlayerId, playerName }); return false; }
    setSavingAvailability(true);
    try {
      const result = await setAvailabilityMutation({
        squadPlayerId,
        availability,
        withdrawFromDraft,
      });
      if (result.requiresWithdrawal) {
        setPendingAvailability({ squadPlayerId, availability, playerName });
        return false;
      }
      setPendingAvailability(null);
      toast.success("Situación actualizada", {
        description: `${playerName} ahora figura como ${availability}.${result.withdrawn ? " Se retiró de las bajas previstas del draft." : ""}`,
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

  const confirmAvailability = async () => {
    if (!pendingAvailability || savingAvailability) return;
    await saveAvailability(
      pendingAvailability.squadPlayerId,
      pendingAvailability.availability,
      pendingAvailability.playerName,
      true,
    );
  };
  const cancelAvailability = () => {
    if (!savingAvailability) setPendingAvailability(null);
  };
  return {
    pendingSale,
    cancelSale: () => setPendingSale(null),
    saveAvailability,
    savingAvailability,
    pendingAvailability,
    confirmAvailability,
    cancelAvailability,
  };
}
