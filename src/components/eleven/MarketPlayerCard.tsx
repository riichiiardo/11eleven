import type { MarketPlayerView } from "@/convex/appTypes";
import { formatMoney } from "@/convex/rulesEngine";
import { AvailabilityBadge, OvrBadge, PlayerAvatar, PositionPill } from "./PlayerBits";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Market card (prompt §17-20): everything the President needs to decide without
 * opening another screen — who the player is, what he costs, who owns him and
 * whether an offer is even possible. "Not offerable" always carries a written
 * reason, never just a locked icon.
 */
export function MarketPlayerCard({
  player,
  budgetAvailable,
  onOffer,
  compact = false,
}: {
  player: MarketPlayerView;
  budgetAvailable: number;
  onOffer: (player: MarketPlayerView) => void;
  compact?: boolean;
}) {
  const isFree = player.kind === "libre";
  // "libre" is not a squad availability flag: free agents have no President to
  // negotiate with, so the badge is replaced instead of mislabelled.
  const squadAvailability =
    player.availability === "libre" ? null : player.availability;
  const maxOffer = Math.max(0, budgetAvailable);

  return (
    <article
      className={cn(
        "card-soft flex h-full flex-col gap-3 p-3.5 transition-shadow hover:shadow-md",
        !player.offerable && "opacity-90",
      )}
    >
      <div className="flex items-start gap-3">
        <PlayerAvatar name={player.name} flag={player.flag} group={player.group} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold">{player.name}</h3>
          <p className="truncate text-[11px] text-muted-foreground">
            {player.nationality} · {player.age} años
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <PositionPill position={player.position} group={player.group} />
            <span className="num rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
              {player.realClub}
            </span>
          </div>
        </div>
        <OvrBadge ovr={player.ovr} />
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="num text-lg font-bold text-primary">
          {formatMoney(player.value)}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {isFree ? "Coste de firma" : "Valoración"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {squadAvailability ? (
          <AvailabilityBadge availability={squadAvailability} />
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            <Sparkles className="size-3" aria-hidden="true" />
            AGENTE LIBRE
          </span>
        )}
        {player.ownerClubName ? (
          <span className="truncate text-[11px] text-muted-foreground">
            {player.ownerClubName}
            {player.ownerNickname ? ` · ${player.ownerNickname}` : ""}
          </span>
        ) : null}
      </div>

      {!compact ? (
        <p
          className={cn(
            "rounded-lg border p-2 text-[11px] leading-relaxed",
            player.offerable
              ? "border-border bg-muted/40 text-muted-foreground"
              : "border-amber-500/35 bg-amber-500/[0.07] text-amber-800 dark:text-amber-200",
          )}
        >
          {player.offerable
            ? isFree
              ? `Presupuesto disponible ${formatMoney(budgetAvailable)} · oferta máxima ${formatMoney(maxOffer)}.`
              : "Puedes iniciar una negociación con su Presidente desde aquí."
            : player.blockedReason}
        </p>
      ) : null}

      <div className="mt-auto flex items-center gap-2">
        {player.offerable ? (
          <Button
            type="button"
            className="min-h-11 flex-1"
            onClick={() => onOffer(player)}
          >
            {isFree ? "Fichar" : "Hacer oferta"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled
            className="min-h-11 flex-1"
            title={player.blockedReason ?? undefined}
          >
            <Lock className="size-4" aria-hidden="true" />
            {player.ownerIsMe ? "Tu jugador" : "No disponible"}
          </Button>
        )}
      </div>
    </article>
  );
}