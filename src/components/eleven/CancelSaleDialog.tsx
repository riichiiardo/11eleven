import { useEffect, useState } from "react";
import type { OfferView } from "@/domain/appTypes";
import { TRANSFER_MODES, transferMode } from "@/domain/transfer-modes";
import { formatMoney } from "@/domain/rulesEngine";
import { rpc } from "@/infrastructure/supabase/client";
import { queryStore } from "@/services/backend/query-store";
import { errorMessage } from "@/lib/errors";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
export function CancelSaleDialog({
  offer,
  onClose,
}: {
  offer: OfferView;
  onClose: () => void;
}) {
  const [items, setItems] = useState<OfferView[]>([]);
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    rpc<OfferView[]>("sale_alternatives", { p_offer_id: offer.id })
      .then((v) => {
        if (!Array.isArray(v))
          throw Error("No se pudieron verificar las ofertas.");
        if (active) setItems(v);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [offer.id, attempt]);
  async function save() {
    setBusy(true);
    setError("");
    try {
      await rpc("cancel_sale", {
        p_offer_id: offer.id,
        p_alternative_id: selected,
        p_reason: reason.trim(),
      });
      toast.success("Venta cancelada", {
        description:
          "La otra oferta sigue pendiente: revísala y apruébala por separado.",
      });
      onClose();
      queryStore.invalidateAll();
    } catch (e) {
      setError(errorMessage(e));
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
      <DialogContent
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Cancelar venta por otra oferta</DialogTitle>
          <DialogDescription>
            Como propietario, elige la oferta de otro manager que consideras
            mejor. Puede ser dinero, intercambio o ambos. La venta actual se
            cancelará; la nueva no se acepta automáticamente.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p role="status">Consultando ofertas…</p>
        ) : items.length ? (
          <>
            <label className="space-y-2">
              Oferta que prefieres
              <select
                className="min-h-11 w-full rounded border bg-background p-2 pr-10"
                value={selected}
                disabled={busy}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Selecciona otra oferta</option>
                {items.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.bidderClubName} · {TRANSFER_MODES[transferMode(o)]} ·{" "}
                    {formatMoney(o.cash)} ·{" "}
                    {o.offered.map((p) => p.name).join(", ") || "Sin jugadores"}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              Por qué consideras mejor esta oferta
              <Textarea
                value={reason}
                disabled={busy}
                minLength={5}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          </>
        ) : !error ? (
          <p role="status">
            No hay otra oferta activa y válida de otro manager por este jugador.
            La venta se mantiene.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-destructive">
            {error}{" "}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setError("");
                setLoading(true);
                setAttempt((a) => a + 1);
              }}
            >
              Actualizar ofertas
            </Button>
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Volver sin cambios
          </Button>
          <Button
            disabled={busy || loading || !selected || reason.trim().length < 5}
            onClick={() => void save()}
          >
            {busy ? "Guardando…" : "Confirmar cancelación de venta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
