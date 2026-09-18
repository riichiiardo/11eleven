import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

export type DraftConfig = {
  totalRounds: number;
  pickSeconds: number;
  snake: boolean;
  orderMode: "inscripcion" | "sorteo";
};

/**
 * Draft operations answer with a sentence and a consequence: whether the draft
 * closed, whose turn it is now, or which rule stopped the pick. The hook keeps
 * that promise — it never surfaces a bare status code.
 */
export function useDraftActions() {
  const prepareMutation = useMutation(api.draft.prepare);
  const openMutation = useMutation(api.draft.open);
  const pauseMutation = useMutation(api.draft.pause);
  const resumeMutation = useMutation(api.draft.resume);
  const skipMutation = useMutation(api.draft.skipTurn);
  const closeMutation = useMutation(api.draft.close);
  const pickMutation = useMutation(api.draft.pick);
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

  const prepare = (config: DraftConfig) =>
    wrap("prepare", () => prepareMutation(config), {
      failure: "No se pudo preparar el draft",
      success: (result) => {
        const { orderSize, totalSteps } = result as {
          orderSize: number;
          totalSteps: number;
        };
        toast.success("Draft preparado", {
          description: `${orderSize} Presidente(s) en el orden · ${totalSteps} turnos en total. Aprueba el orden y ábrelo cuando el mercado esté listo.`,
        });
      },
    });

  const open = () =>
    wrap("open", () => openMutation(), {
      failure: "No se pudo abrir el draft",
      success: (result) => {
        const { executed, invalidated } = result as {
          executed: number;
          invalidated: number;
        };
        toast.success("Draft abierto · mercado cerrado", {
          description:
            executed + invalidated === 0
              ? "No había operaciones reservadas. El primer Presidente ya tiene el turno."
              : `${executed} operación(es) acordadas ejecutadas${
                  invalidated > 0
                    ? ` y ${invalidated} invalidadas con su motivo registrado`
                    : ""
                }.`,
        });
      },
    });

  const pause = () =>
    wrap("pause", () => pauseMutation(), {
      failure: "No se pudo pausar el draft",
      success: () => {
        toast.info("Draft en pausa", {
          description: "El reloj está detenido y nadie puede fichar.",
        });
      },
    });

  const resume = () =>
    wrap("resume", () => resumeMutation(), {
      failure: "No se pudo reanudar el draft",
      success: () => {
        toast.success("Draft reanudado", {
          description: "Los turnos vuelven a estar activos.",
        });
      },
    });

  const skipTurn = () =>
    wrap("skip", () => skipMutation({}), {
      failure: "No se pudo saltar el turno",
      success: () => {
        toast.info("Turno saltado", {
          description: "El registro de auditoría guarda a quién se le pasó el turno.",
        });
      },
    });

  const close = () =>
    wrap("close", () => closeMutation(), {
      failure: "No se pudo cerrar el draft",
      success: (result) => {
        const { picks } = result as { picks: number };
        toast.success("Draft cerrado · plantillas bloqueadas", {
          description: `${picks} adquisición(es) registradas. Los Presidentes solo pueden ajustar su once.`,
        });
      },
    });

  const pick = (playerId: Id<"players">) =>
    wrap(
      `pick-${playerId}`,
      () => pickMutation({ playerId }),
      {
        failure: "No se pudo completar el fichaje",
        success: (result) => {
          const { playerName, price, draftClosed, nextNickname } = result as {
            playerName: string;
            price: number;
            draftClosed: boolean;
            nextNickname: string | null;
          };
          toast.success(`${playerName} es tuyo`, {
            description: draftClosed
              ? `Pagaste ${(price / 1_000_000).toFixed(1)} M€ y el draft quedó cerrado: se completaron todas las rondas.`
              : `Pagaste ${(price / 1_000_000).toFixed(1)} M€. Ahora elige ${
                  nextNickname ?? "el siguiente Presidente"
                }.`,
          });
        },
      },
    );

  return {
    prepare,
    open,
    pause,
    resume,
    skipTurn,
    close,
    pick,
    busyKey,
    busy: busyKey !== null,
  };
}
