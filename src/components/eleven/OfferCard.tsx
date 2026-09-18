import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { OfferView, OfferPlayerLite } from "@/convex/appTypes";
import { OFFER_STATUS_META, type OfferStatus } from "@/convex/marketEngine";
import { formatMoney } from "@/convex/rulesEngine";
import { useMarketActions } from "@/hooks/use-market-actions";
import { formatDateTime, relativeTime } from "@/lib/errors";
import { useNow } from "@/hooks/use-tournament";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RuleCheckList } from "./RuleCheckList";
import { Crest } from "./Crest";
import { OfferStatusPill } from "./OfferBits";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  BadgeEuro,
  Check,
  ClipboardCheck,
  Loader2,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One negotiation. The card always states who is involved, what changes hands,
 * which side the President is on and what happens if he presses the button —
 * including the *why* when the engine refuses (prompt §41: never "Error 409").
 */
export function OfferCard({ offer }: { offer: OfferView }) {
  const now = useNow(30000);
  const { respondOffer, cancelOffer, busyKey } = useMarketActions();
  const [validationOpen, setValidationOpen] = useState(false);
  const meta = OFFER_STATUS_META[offer.status as OfferStatus];

  const awaitingMe = offer.canRespond;
  const decided =
    offer.status === "aceptada" ||
    offer.status === "reservada" ||
    offer.status === "ejecutada";

  return (
    <article
      className={cn(
        "card-soft flex flex-col gap-3 p-3.5",
        awaitingMe && "border-amber-500/45",
        offer.status === "invalidada" && "border-rose-500/45",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <OfferStatusPill status={offer.status as OfferStatus} />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {offer.type === "trade" ? "Intercambio" : "Operación en efectivo"}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {offer.bidderIsMe ? "La enviaste" : `${offer.bidderNickname} la envió`} ·{" "}
            {relativeTime(offer.updatedAt, now)}
            {offer.executedAt ? ` · ejecutada ${formatDateTime(offer.executedAt)}` : ""}
          </p>
        </div>
        {awaitingMe ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-200">
            Requiere tu respuesta
          </span>
        ) : null}
      </header>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <ClubBlock
          nickname={offer.bidderNickname}
          clubName={offer.bidderClubName}
          colors={offer.bidderClubColors}
          isMe={offer.bidderIsMe}
        />
        <span
          aria-hidden="true"
          className="mx-auto flex size-8 items-center justify-center rounded-full border bg-muted text-muted-foreground"
        >
          <ArrowRight className="size-4" />
        </span>
        <ClubBlock
          nickname={offer.sellerNickname ?? "Agente libre"}
          clubName={offer.sellerClubName ?? "Sin club en el torneo"}
          colors={offer.sellerClubColors ?? ["#334155", "#0f172a"]}
          isMe={offer.side === "recibida" && !offer.bidderIsMe}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <PlayerColumn title="Ofrece" players={offer.offered} empty="Sin jugadores: solo dinero." />
        <PlayerColumn
          title="Solicita"
          players={offer.requested}
          empty="Sin jugadores solicitados."
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-2.5">
        <span className="num inline-flex items-center gap-1.5 text-sm font-bold">
          <BadgeEuro aria-hidden="true" className="size-4 text-muted-foreground" />
          {formatMoney(offer.cash)}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {offer.bidderIsMe
            ? "Salen de tu presupuesto si se ejecuta"
            : "Entran al presupuesto del club vendedor"}
        </span>
      </div>

      {offer.message ? (
        <p className="flex gap-2 rounded-lg border border-border bg-card p-2.5 text-xs leading-relaxed text-muted-foreground">
          <MessageSquare className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {offer.message}
        </p>
      ) : null}

      {offer.blockers.length > 0 && !decided ? (
        <p className="rounded-lg border border-amber-500/35 bg-amber-500/[0.07] p-2.5 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
          {meta.description} {offer.blockers[0]}
        </p>
      ) : null}

      {offer.invalidReason ? (
        <p className="rounded-lg border border-rose-500/35 bg-rose-500/[0.07] p-2.5 text-xs leading-relaxed text-rose-700 dark:text-rose-300">
          {offer.invalidReason}
        </p>
      ) : null}

      <footer className="flex flex-wrap items-center gap-2">
        {offer.canRespond ? (
          <>
            <Button
              type="button"
              className="min-h-11"
              disabled={busyKey !== null}
              onClick={() => respondOffer(offer.id, "aceptar")}
            >
              {busyKey === `aceptar-${offer.id}` ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="size-4" aria-hidden="true" />
              )}
              Aceptar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busyKey !== null}
              onClick={() => respondOffer(offer.id, "rechazar")}
            >
              Rechazar
            </Button>
          </>
        ) : null}
        {offer.canCancel ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 text-muted-foreground"
            disabled={busyKey !== null}
            onClick={() => cancelOffer(offer.id)}
          >
            {busyKey === `cancelar-${offer.id}` ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="size-4" aria-hidden="true" />
            )}
            Cancelar operación
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="min-h-11 sm:ml-auto"
          onClick={() => setValidationOpen(true)}
        >
          <ClipboardCheck className="size-4" aria-hidden="true" />
          Ver validación
        </Button>
      </footer>

      {!awaitingMe && offer.status === "enviada" && offer.side === "enviada" ? (
        <p className="text-[11px] text-muted-foreground">
          Esperando la respuesta de {offer.sellerNickname ?? "el club"}. Si no
          responde, la operación expira sin efecto.
        </p>
      ) : null}

      <ValidationDialog
        offerId={offer.id}
        open={validationOpen}
        onOpenChange={setValidationOpen}
        status={offer.status as OfferStatus}
      />
    </article>
  );
}

function ValidationDialog({
  offerId,
  open,
  onOpenChange,
  status,
}: {
  offerId: OfferView["id"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: OfferStatus;
}) {
  const report = useQuery(
    api.market.validateOffer,
    open ? { offerId } : "skip",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto scroll-thin sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="display text-base">
            Validación final de la operación
          </DialogTitle>
          <DialogDescription>
            {OFFER_STATUS_META[status].description} Todo vuelve a comprobarse contra
            el estado actual de ambas plantillas justo antes de aplicar los cambios.
          </DialogDescription>
        </DialogHeader>

        {report === undefined ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Comprobando jugadores, presupuestos y reglas…
          </p>
        ) : report === null ? (
          <p className="text-sm text-muted-foreground">
            No tienes acceso a esta operación.
          </p>
        ) : (
          <>
            <p
              className={cn(
                "rounded-lg border p-2.5 text-sm font-semibold",
                report.passed
                  ? "border-emerald-500/35 bg-emerald-500/[0.07] text-emerald-800 dark:text-emerald-200"
                  : "border-rose-500/35 bg-rose-500/[0.07] text-rose-700 dark:text-rose-300",
              )}
            >
              {report.passed
                ? "La operación supera todas las comprobaciones: está lista para ejecutarse."
                : "La operación no puede ejecutarse en este momento."}
            </p>
            <Separator />
            <RuleCheckList checks={report.checks} variant="full" />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ClubBlock({
  nickname,
  clubName,
  colors,
  isMe,
}: {
  nickname: string;
  clubName: string;
  colors: [string, string];
  isMe: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border p-2.5">
      <Crest name={clubName} shortName={initialsOf(clubName)} colors={colors} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{clubName}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {nickname}
          {isMe ? " · tú" : ""}
        </p>
      </div>
    </div>
  );
}

function PlayerColumn({
  title,
  players,
  empty,
}: {
  title: string;
  players: OfferPlayerLite[];
  empty: string;
}) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {players.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1">
          {players.map((player) => (
            <li key={player.playerId} className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-semibold">
                {player.flag} {player.name}
              </span>
              <span className="num shrink-0 text-[11px] text-muted-foreground">
                {player.position} · OVR {player.ovr} · {formatMoney(player.value)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts
    .slice(0, 3)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
