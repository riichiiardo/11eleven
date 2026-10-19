import { useState } from "react";
import type { MarketPlayerView } from "@/convex/appTypes";
import { bidMoney, type DepartureBid } from "@/hooks/use-departure-bids";
import { rpc } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
export function DepartureBidDialog({
  player,
  bid,
  onClose,
}: {
  player: MarketPlayerView;
  bid: DepartureBid;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(
    String(Math.max(bid.highestCash ?? 0, bid.myCash ?? 0) + 1),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send() {
    const cash = Number(amount);
    if (!Number.isSafeInteger(cash) || cash <= 0) {
      setError("Introduce una cantidad positiva de euros enteros.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await rpc("place_departure_bid", {
        p_player_id: player.playerId,
        p_cash: cash,
      });
      window.dispatchEvent(new Event("eleven:departure-bids"));
      toast.success("Puja enviada", {
        description:
          "El propietario recibirá una notificación y decidirá si acepta. No se ha comprado ni reservado al jugador.",
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar la puja.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pujar por {player.name}</DialogTitle>
          <DialogDescription>
            Destinatario: {player.ownerClubName}. La oferta más alta no gana
            automáticamente: el propietario decide cuándo y con quién cerrar el
            acuerdo.
          </DialogDescription>
        </DialogHeader>
        <p>
          Mayor oferta individual:{" "}
          {bid.highestCash == null
            ? "Todavía no hay ofertas"
            : bidMoney(bid.highestCash)}
        </p>
        {bid.myCash != null && (
          <p>
            Tu puja actual: {bidMoney(bid.myCash)}. Mejorarla actualiza la misma
            oferta, sin comprometer dos veces su importe.
          </p>
        )}
        <label className="space-y-2">
          Mi oferta (€)
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="block min-h-11 w-full rounded border p-2"
            disabled={busy}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <p className="text-sm text-muted-foreground">
          Puedes ofrecer más o menos que la mayor oferta; para mejorar una puja
          tuya debes superar tu importe anterior. La oferta no evita la
          rescisión hasta que sea aceptada o reservada.
        </p>
        <div className="flex gap-2">
          <Button disabled={busy || bid.closed} onClick={() => void send()}>
            {busy
              ? "Enviando…"
              : bid.myCash != null
                ? "Mejorar mi puja"
                : "Enviar puja"}
          </Button>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
