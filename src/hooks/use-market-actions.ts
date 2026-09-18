import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { OFFER_STATUS_META, type OfferStatus } from "@/convex/marketEngine";
import { errorMessage } from "@/lib/errors";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

export type OfferDraft = {
  requestedPlayerIds: Id<"players">[];
  offeredPlayerIds: Id<"players">[];
  cash: number;
  message?: string;
};

/**
 * Every market mutation answers with a sentence the President can read. The
 * hook keeps that contract: it never surfaces a bare status code, and it only
 * toasts once the backend has actually applied (or refused) the operation.
 */
export function useMarketActions() {
  const createOfferMutation = useMutation(api.market.createOffer);
  const respondMutation = useMutation(api.market.respondOffer);
  const cancelMutation = useMutation(api.market.cancelOffer);
  const executeMutation = useMutation(api.market.executeReserved);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const wrap = async <T,>(
    key: string,
    action: () => Promise<T>,
    options: { failure: string; success?: (result: T) => void },
  ): Promise<T | null> => {
    setBusyKey(key);
    try {
      const result = await action();
      options.success?.(result);
      return result;
    } catch (cause) {
      toast.error(options.failure, { description: errorMessage(cause) });
      return null;
    } finally {
      setBusyKey(null);
    }
  };

  const sendOffer = (draft: OfferDraft) =>
    wrap(
      "crear",
      () => createOfferMutation(draft),
      {
        failure: "No se pudo registrar la operación",
        success: (result) => {
          const status = result.status as OfferStatus;
          const meta = OFFER_STATUS_META[status];
          const toastFn = status === "ejecutada" ? toast.success : toast.info;
          toastFn(`${meta.label}`, { description: result.message });
        },
      },
    );

  const respondOffer = (offerId: Id<"offers">, action: "aceptar" | "rechazar") =>
    wrap(
      `${action}-${offerId}`,
      () => respondMutation({ offerId, action }),
      {
        failure:
          action === "aceptar"
            ? "No se pudo aceptar la operación"
            : "No se pudo rechazar la operación",
        success: () => {
          toast.success(
            action === "aceptar"
              ? "Acuerdo alcanzado"
              : "Operación rechazada",
            {
              description:
                action === "aceptar"
                  ? "La operación quedó reservada. Se ejecutará con la validación final cuando Administración abra la ventana."
                  : "El otro Presidente recibió tu respuesta.",
            },
          );
        },
      },
    );

  const cancelOffer = (offerId: Id<"offers">) =>
    wrap(`cancelar-${offerId}`, () => cancelMutation({ offerId }), {
      failure: "No se pudo cancelar la operación",
      success: () => {
        toast.info("Operación cancelada", {
          description: "Los jugadores implicados vuelven a estar disponibles.",
        });
      },
    });

  const executeReserved = (offerId?: Id<"offers">) =>
    wrap("ejecutar", () => executeMutation(offerId ? { offerId } : {}), {
      failure: "No se pudieron ejecutar las operaciones reservadas",
      success: (result) => {
        const { executed, invalidated } = result as {
          executed: number;
          invalidated: number;
        };
        if (executed === 0 && invalidated === 0) {
          toast.info("No había operaciones pendientes de ejecución.");
          return;
        }
        toast.success(
          `${executed} operación(es) ejecutada(s)`,
          invalidated > 0
            ? {
                description: `${invalidated} operación(es) no superaron la validación final y quedaron registradas con su motivo.`,
              }
            : { description: "Cada operación quedó registrada en la auditoría." },
        );
      },
    });

  return {
    sendOffer,
    respondOffer,
    cancelOffer,
    executeReserved,
    busyKey,
    busy: busyKey !== null,
  };
}
