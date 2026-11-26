import { useEffect, useState } from "react";
import { Handshake } from "lucide-react";
import { toast } from "sonner";
import { rpc } from "@/infrastructure/supabase/client";
import { useMutation } from "@/services/backend/react";
import { errorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/eleven/SectionCard";

type ReservedPlayer = {
  offerId: string;
  playerId: string;
  name: string;
  destination: string;
  exchange: boolean;
};

export function DraftReservedPlayers({ enabled }: { enabled: boolean }) {
  const [players, setPlayers] = useState<ReservedPlayer[]>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, refresh] = useState(0);
  const mutate = useMutation();
  useEffect(() => {
    let active = true;
    rpc<ReservedPlayer[]>("draft_reserved_players")
      .then((rows) => {
        if (active) {
          setPlayers(rows);
          setError("");
        }
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [revision]);

  async function resolve(player: ReservedPlayer) {
    setBusy(true);
    try {
      await mutate("draft.executeReservedOffer", { offerId: player.offerId });
      toast.success(
        player.exchange ? "Intercambio ejecutado" : "Traspaso ejecutado",
      );
      refresh((n) => n + 1);
    } catch (cause) {
      toast.error("No se pudo resolver el acuerdo", {
        description: errorMessage(cause),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title="Acuerdos reservados por jugador" icon={Handshake}>
      {error ? (
        <p role="alert">{error}</p>
      ) : !players ? (
        <p role="status">Cargando acuerdos…</p>
      ) : players.length === 0 ? (
        <p>No hay acuerdos reservados.</p>
      ) : (
        <>
          {!enabled && (
            <p className="text-sm">Abre el draft para resolver los acuerdos.</p>
          )}
          <ul className="divide-y">
            {players.map((player) => (
              <li
                key={player.offerId + ":" + player.playerId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <strong>{player.name}</strong>
                  <p className="text-sm">Destino {player.destination}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!enabled || busy}
                  aria-label={`Resolver acuerdo de ${player.name}`}
                  onClick={() => void resolve(player)}
                >
                  {player.exchange
                    ? "Resolver intercambio"
                    : "Resolver acuerdo"}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </SectionCard>
  );
}
