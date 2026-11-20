import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { rpc } from "@/infrastructure/supabase/client";
import { queryStore } from "@/services/backend/query-store";
import { errorMessage } from "@/lib/errors";
import { formatMoney } from "@/domain/rulesEngine";
import type { SaleSelection } from "@/hooks/use-squad-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
type Negotiation = {
  offerId: string;
  clubId: string;
  clubName: string;
  manager: string;
  status: string;
  cash: number;
};
const STATUS: Record<string, string> = {
  enviada: "Oferta enviada",
  negociacion: "En negociación",
  aceptada: "Aceptada",
  reservada: "Reservada",
};
export function SoldPlayerDialog({
  selection,
  onClose,
}: {
  selection: SaleSelection;
  onClose: () => void;
}) {
  const [offers, setOffers] = useState<Negotiation[]>([]);
  const [offerId, setOfferId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [withdraw, setWithdraw] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    rpc<Negotiation[]>("squad_sale_negotiations", {
      p_squad_player_id: selection.squadPlayerId,
    })
      .then((value) => {
        if (!Array.isArray(value))
          throw new Error("Respuesta de negociaciones no válida.");
        if (current) {
          setOffers(value);
          if (value.length === 1) setOfferId(value[0].offerId);
        }
      })
      .catch((cause) => {
        if (current) setError(errorMessage(cause));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [selection.squadPlayerId, attempt]);
  const chosen = offers.find((offer) => offer.offerId === offerId);
  const save = async () => {
    if (!chosen || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await rpc<{
        requiresWithdrawal: boolean;
        withdrawn: boolean;
        clubName: string;
      }>("mark_squad_player_sold", {
        p_squad_player_id: selection.squadPlayerId,
        p_offer_id: chosen.offerId,
        p_withdraw: withdraw,
      });
      if (result.requiresWithdrawal) {
        setWithdraw(true);
        return;
      }
      toast.success("Jugador marcado como vendido", {
        description: `${selection.playerName} · ${result.clubName}${result.withdrawn ? " · Retirado de las bajas previstas" : ""}`,
      });
      onClose();
      queryStore.invalidateAll();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Marcar vendido · {selection.playerName}</DialogTitle>
          <DialogDescription>
            Selecciona la negociación del equipo comprador. Se registrará
            «Vendido» y el equipo; el jugador, el presupuesto y la aceptación de
            la oferta siguen gestionándose en Negociaciones.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p role="status">Consultando negociaciones…</p>
        ) : offers.length ? (
          <div className="space-y-2">
            <label htmlFor="sold-offer" className="text-sm font-semibold">
              Equipo y negociación
            </label>
            <Select
              value={offerId}
              disabled={busy}
              onValueChange={(value) => {
                setOfferId(value);
                setWithdraw(false);
                setError("");
              }}
            >
              <SelectTrigger id="sold-offer" className="min-h-11 w-full">
                <SelectValue placeholder="Selecciona el equipo comprador" />
              </SelectTrigger>
              <SelectContent>
                {offers.map((offer) => (
                  <SelectItem key={offer.offerId} value={offer.offerId}>
                    {offer.clubName} · {STATUS[offer.status] ?? offer.status} ·{" "}
                    {offer.offerId.slice(-6)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {chosen ? (
              <p className="text-xs text-muted-foreground">
                Manager: {chosen.manager}. Oferta total:{" "}
                {formatMoney(chosen.cash)}.{" "}
                {STATUS[chosen.status] ?? chosen.status}.
              </p>
            ) : null}
          </div>
        ) : !error ? (
          <p role="status" className="text-sm">
            No hay negociaciones activas por este jugador.{" "}
            <Link
              className="underline"
              to="/dashboard/mercado/negociaciones"
              onClick={onClose}
            >
              Ir a Negociaciones
            </Link>
          </p>
        ) : null}
        {withdraw ? (
          <p
            role="alert"
            className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
          >
            Este jugador está en las bajas previstas. Para marcarlo como vendido
            debes retirarlo de esa lista. Dejará de estar previsto para la
            rescisión automática al abrir el draft. Las otras bajas y las
            ofertas se conservan.
          </p>
        ) : null}
        {error ? (
          <div role="alert" className="text-sm text-destructive">
            {error}
            {!offers.length ? (
              <Button
                type="button"
                variant="outline"
                className="ml-2"
                onClick={() => {
                  setLoading(true);
                  setError("");
                  setAttempt(attempt + 1);
                }}
              >
                Reintentar
              </Button>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={loading || busy || !chosen}
            onClick={() => void save()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {busy
              ? "Guardando…"
              : withdraw
                ? "Retirar baja y marcar vendido"
                : "Marcar vendido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
