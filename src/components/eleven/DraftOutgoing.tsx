import { useEffect, useState } from "react";
import { rpc } from "@/lib/supabase/client";
import type { PrelistPlayer } from "@/lib/draft-prelist";
import { formatMoney } from "@/convex/rulesEngine";
import { Button } from "@/components/ui/button";

type OutgoingState = {
  locked: boolean;
  players: {
    id: string;
    value: number;
    compensation: number;
    negotiated: boolean;
  }[];
  receipts: {
    cycleId: string;
    playerId: string;
    name: string;
    value: number;
    amount: number;
    outcome: "released" | "negotiated" | "transferred";
  }[];
};

export function DraftOutgoing({
  players,
  selected,
  limit,
  revision,
  onChange,
}: {
  players: PrelistPlayer[];
  selected: string[];
  limit: number;
  revision: number;
  onChange: (ids: string[]) => void;
}) {
  const [state, setState] = useState<OutgoingState | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const next = await rpc<OutgoingState>("draft_outgoing_state");
        if (
          !next ||
          !Array.isArray(next.players) ||
          !Array.isArray(next.receipts)
        )
          throw new Error("No se pudo verificar el estado de las bajas.");
        if (active) {
          setState(next);
          setError("");
        }
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudieron consultar las bajas.",
          );
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [revision, attempt]);
  const cap = Math.min(6, limit);
  const planned = players.filter((p) => selected.includes(p.id));
  return (
    <section
      aria-label="Bajas previstas"
      className="space-y-3 rounded-lg border p-4"
    >
      <h3 className="font-semibold">Bajas previstas · máximo {cap}</h3>
      <p className="text-sm text-muted-foreground">
        Al guardar la prelista, estas bajas se publican como transferibles para
        los demás presidentes. Cancelar descarta los cambios sin publicarlos.
      </p>
      <p className="text-sm text-muted-foreground">
        En la primera apertura del draft, los jugadores que continúen en tu club
        sin un acuerdo aceptado o reservado se rescinden automáticamente:
        recibes el 75 % de su valor actual. Una oferta o negociación abierta no
        evita la rescisión.
      </p>
      {error && (
        <div role="alert">
          <p>{error} No puedes cambiar las bajas hasta verificar su estado.</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setAttempt((v) => v + 1)}
          >
            Reintentar bajas
          </Button>
        </div>
      )}
      {state?.locked ? (
        <p role="status">
          El draft ya comenzó. La selección de bajas está cerrada.
        </p>
      ) : (
        <fieldset
          disabled={!state || Boolean(error)}
          className="grid gap-2 sm:grid-cols-2"
        >
          <legend className="mb-2 text-sm">
            Selecciona hasta {cap} jugadores de tu plantilla
          </legend>
          {players.map((player) => (
            <label
              key={player.id}
              className="flex min-h-11 items-center gap-3 rounded border p-2 text-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(player.id)}
                disabled={
                  !selected.includes(player.id) && selected.length >= cap
                }
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, player.id]
                      : selected.filter((id) => id !== player.id),
                  )
                }
              />
              {player.name}
            </label>
          ))}
          {!players.length && <p>No hay jugadores en tu plantilla.</p>}
        </fieldset>
      )}
      {!state?.locked && planned.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold">
            Rescisión prevista al inicio del draft
          </h4>
          <ul className="space-y-2">
            {planned.map((player) => {
              const detail = state?.players.find((p) => p.id === player.id);
              return (
                <li key={player.id} className="rounded border p-3 text-sm">
                  <span className="font-medium">{player.name}</span>
                  {detail && (
                    <>
                      <p>Valor actual: {formatMoney(detail.value)}</p>
                      <p>
                        {detail.negotiated
                          ? "Acuerdo aceptado o reservado · excluido de rescisión"
                          : `Ingreso previsto (75 %): ${formatMoney(detail.compensation)}`}
                      </p>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            Importes estimados: se calculan con el valor vigente al abrir el
            draft, no con el valor de adquisición.
          </p>
        </div>
      )}
      {state && state.receipts.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold">Resultado de las bajas del draft</h4>
          <ul className="space-y-2">
            {state.receipts.map((item) => (
              <li
                key={`${item.cycleId}:${item.playerId}`}
                className="rounded border p-3 text-sm"
              >
                {item.name} ·{" "}
                {item.outcome === "released"
                  ? `Rescindido · ingreso ${formatMoney(item.amount)} (75 % de ${formatMoney(item.value)})`
                  : item.outcome === "negotiated"
                    ? "Acuerdo aceptado o reservado · sin rescisión ni abono adicional"
                    : "Ya no pertenecía al club · sin abono adicional"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
