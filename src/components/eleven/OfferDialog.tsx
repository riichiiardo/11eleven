import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MarketPlayerView, BudgetView } from "@/convex/appTypes";
import { formatMoney, type SquadPlayerView } from "@/convex/rulesEngine";
import { useMarketActions } from "@/hooks/use-market-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RuleCheckList } from "./RuleCheckList";
import { PlayerAvatar, PositionPill } from "./PlayerBits";
import { useQuery } from "convex/react";
import { ArrowLeftRight, BadgeEuro, Coins, Loader2, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "cash" | "trade";

/**
 * The offer builder. It never waits for "Guardar" to validate: the same rule
 * engine that guards the server also drives the live preview, so the President
 * sees exactly which rule blocks the operation and what he can do about it.
 */
export function OfferDialog({
  player,
  squad,
  budget,
  open,
  onOpenChange,
}: {
  /** Callers mount this dialog per target, so a new target starts a clean offer. */
  player: MarketPlayerView;
  squad: SquadPlayerView[];
  budget: BudgetView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { sendOffer, busyKey } = useMarketActions();
  const isFree = player.kind === "libre";
  const [mode, setMode] = useState<Mode>("cash");
  const [offeredId, setOfferedId] = useState<string>("");
  const [cashInput, setCashInput] = useState(() =>
    player.kind === "libre" ? (player.value / 1_000_000).toFixed(1) : "0",
  );
  const [message, setMessage] = useState("");

  const cash = Math.max(0, Math.round((Number(cashInput) || 0) * 1_000_000));
  const offeredPlayerIds = useMemo<Id<"players">[]>(
    () =>
      mode === "trade" && offeredId
        ? [offeredId as Id<"players">]
        : [],
    [mode, offeredId],
  );

  const guidance = useQuery(
    api.market.guidance,
    open
      ? {
          requestedPlayerIds: [player.playerId],
          offeredPlayerIds,
          cash,
        }
      : "skip",
  );

  const tradeNeedsPlayer = mode === "trade" && offeredPlayerIds.length === 0;
  const blocked = guidance ? !guidance.passed : true;
  const canSubmit = !blocked && !tradeNeedsPlayer && busyKey !== "crear";
  const committedInOffers = guidance
    ? Math.max(0, budget.available - guidance.spendable)
    : 0;

  const handleSubmit = async () => {
    // A free agent has no counterpart, so the operation always pays his exact
    // signing cost; a trade pays whatever the President typed.
    const result = await sendOffer({
      requestedPlayerIds: [player.playerId],
      offeredPlayerIds,
      cash: isFree ? player.value : cash,
      message: message.trim() || undefined,
    });
    if (result) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto scroll-thin sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="display text-base">
            {isFree ? `Fichar a ${player.name}` : `Oferta por ${player.name}`}
          </DialogTitle>
          <DialogDescription>
            {player.ownerClubName
              ? `Presidente destinatario: ${player.ownerNickname ?? "sin asignar"} · ${player.ownerClubName}`
              : "Agente libre: no requiere acuerdo entre Presidentes."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-xl border bg-gradient-to-br from-navy to-navy-deep p-3.5 text-white">
          <PlayerAvatar name={player.name} flag={player.flag} group={player.group} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="display truncate text-base">{player.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <PositionPill position={player.position} group={player.group} />
              <span className="num rounded-md bg-white/15 px-2 py-0.5 text-xs font-bold">
                OVR {player.ovr}
              </span>
              <span className="num text-xs text-white/75">{player.age} años</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">
              {isFree ? "Coste de firma" : "Valoración"}
            </p>
            <p className="num text-xl font-bold text-brand-bright">
              {formatMoney(player.value)}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Money label="Presupuesto disponible" value={formatMoney(budget.available)} />
          <Money
            label="Comprometido en operaciones"
            value={formatMoney(committedInOffers)}
          />
          <Money
            label="Oferta máxima"
            value={guidance ? formatMoney(guidance.guidance.maxOffer) : "—"}
          />
        </dl>

        {!isFree ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cómo quieres negociar
            </p>
            <div role="radiogroup" aria-label="Tipo de operación" className="grid gap-2 sm:grid-cols-2">
              <ModeButton
                active={mode === "cash"}
                icon={BadgeEuro}
                title="Solo dinero"
                description="Ofreces presupuesto al club de este jugador."
                onClick={() => setMode("cash")}
              />
              <ModeButton
                active={mode === "trade"}
                icon={ArrowLeftRight}
                title="Intercambio"
                description="Ofreces un jugador de tu plantilla, con o sin dinero."
                onClick={() => setMode("trade")}
              />
            </div>
          </div>
        ) : null}

        {mode === "trade" ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="offer-player">Jugador que ofreces</Label>
            <Select value={offeredId} onValueChange={setOfferedId}>
              <SelectTrigger id="offer-player" className="min-h-11">
                <SelectValue placeholder="Selecciona un jugador de tu plantilla" />
              </SelectTrigger>
              <SelectContent>
                {squad.map((candidate) => (
                  <SelectItem key={candidate.playerId} value={candidate.playerId}>
                    {candidate.name} · {candidate.position} · OVR {candidate.ovr} ·{" "}
                    {formatMoney(candidate.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Ofrecer un jugador libera una plaza y su valor deja de contar en tu
              plantilla; el motor comprueba los cupos en ambos clubes antes de
              aceptar la operación.
            </p>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="offer-cash">
              {isFree ? "Coste de firma (M€)" : "Dinero añadido (M€)"}
            </Label>
            <div className="relative">
              <Coins
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id="offer-cash"
                type="number"
                min={0}
                step={0.5}
                inputMode="decimal"
                value={cashInput}
                disabled={isFree}
                aria-describedby={isFree ? "offer-cash-hint" : undefined}
                onChange={(event) => setCashInput(event.target.value)}
                className="num h-11 w-full rounded-lg border bg-card pl-9 pr-3 text-sm font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
              />
            </div>
            {isFree ? (
              <p id="offer-cash-hint" className="text-[11px] text-muted-foreground">
                Es el coste de firma del agente libre: el sistema lo calcula a partir
                de su valoración. Se descuenta de tu presupuesto al ejecutarse.
              </p>
            ) : guidance ? (
              <p className="text-[11px] text-muted-foreground">
                Sugerido por valoración: {formatMoney(guidance.guidance.suggested)} ·{" "}
                límite de puja: {formatMoney(guidance.guidance.walkAway)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="offer-message">Mensaje para el Presidente</Label>
            <Textarea
              id="offer-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Explica brevemente tu propuesta…"
              className="min-h-11"
              rows={2}
            />
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Validación del motor de reglas
          </p>
          {!guidance ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Comprobando reglas del torneo…
            </p>
          ) : (
            <RuleCheckList checks={guidance.checks} variant="full" />
          )}
          {tradeNeedsPlayer ? (
            <p className="rounded-lg border border-amber-500/35 bg-amber-500/[0.07] p-2.5 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
              Selecciona el jugador de tu plantilla que formará parte del
              intercambio.
            </p>
          ) : null}
        </div>

        {guidance ? (
          <p
            className={cn(
              "flex items-start gap-2 rounded-lg border p-2.5 text-xs leading-relaxed",
              guidance.passed
                ? "border-emerald-500/35 bg-emerald-500/[0.07] text-emerald-800 dark:text-emerald-200"
                : "border-rose-500/35 bg-rose-500/[0.07] text-rose-700 dark:text-rose-300",
            )}
          >
            <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {guidance.passed
                ? isFree
                  ? "La operación cumple el reglamento: si el mercado está abierto se ejecuta de inmediato; si no, queda reservada."
                  : `Oferta lista para enviar a ${guidance.sellerClubName ?? "el club"}. El acuerdo se reserva y se valida otra vez antes de ejecutarse.`
                : guidance.blockers[0]}
            </span>
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {busyKey === "crear" ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Registrando…
              </>
            ) : (
              <>
                <Send className="size-4" aria-hidden="true" />
                {isFree ? "Confirmar fichaje" : "Enviar oferta"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Money({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2.5">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="num mt-0.5 text-sm font-bold">{value}</dd>
    </div>
  );
}

function ModeButton({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: typeof BadgeEuro;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary/40"
          : "border-border bg-card hover:bg-accent",
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-[11px] leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  );
}
