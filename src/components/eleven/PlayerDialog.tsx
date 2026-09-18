import { useState } from "react";
import {
  formatMoney,
  POSITION_LABEL,
  type PlayerAvailability,
  type SquadPlayerView,
} from "@/convex/rulesEngine";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AvailabilityPicker, PlayerAvatar, PositionPill } from "./PlayerBits";
import { Loader2, Shirt, Sparkles } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

export function PlayerDialog({
  player,
  open,
  onOpenChange,
  onAssign,
  assignLabel,
  onSaveAvailability,
  saving,
}: {
  player: SquadPlayerView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign?: (player: SquadPlayerView) => void;
  assignLabel?: string;
  onSaveAvailability: (
    playerId: Id<"players">,
    availability: PlayerAvailability,
  ) => Promise<void>;
  saving?: boolean;
}) {
  const [draft, setDraft] = useState<PlayerAvailability | null>(null);

  if (!player) return null;
  const current = draft ?? player.availability;

  const close = (next: boolean) => {
    if (!next) setDraft(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92vh] overflow-y-auto scroll-thin sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="display text-base">{player.name}</DialogTitle>
          <DialogDescription>
            {player.nationality} {player.flag} · {POSITION_LABEL[player.position]} ·{" "}
            {player.realClub}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 rounded-xl border bg-gradient-to-br from-navy to-navy-deep p-4 text-white">
          <PlayerAvatar name={player.name} flag={player.flag} group={player.group} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="display truncate text-lg">{player.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <PositionPill position={player.position} group={player.group} />
              <span className="num rounded-md bg-white/15 px-2 py-0.5 text-xs font-bold">
                OVR {player.ovr}
              </span>
              <span className="num text-xs text-white/75">{player.age} años</span>
            </div>
            <p className="num mt-2 text-xl font-bold text-brand-bright">
              {formatMoney(player.value)}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border p-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Club de origen
            </dt>
            <dd className="mt-0.5 font-semibold">{player.realClub}</dd>
          </div>
          <div className="rounded-lg border p-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Liga
            </dt>
            <dd className="mt-0.5 font-semibold">{player.realLeague}</dd>
          </div>
          <div className="col-span-2 rounded-lg border p-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Datos de origen
            </dt>
            <dd className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="size-3.5" aria-hidden="true" />
              {player.fcVersion}
            </dd>
          </div>
        </dl>

        <Separator />

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Situación en el mercado
          </p>
          <AvailabilityPicker
            value={current}
            disabled={saving}
            onChange={(next) => setDraft(next)}
          />
          {draft && draft !== player.availability ? (
            <Button
              type="button"
              className="min-h-11"
              disabled={saving}
              onClick={async () => {
                await onSaveAvailability(player.playerId, draft);
                setDraft(null);
              }}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Guardando…
                </>
              ) : (
                "Guardar situación"
              )}
            </Button>
          ) : null}
        </div>

        {onAssign ? (
          <>
            <Separator />
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                onAssign(player);
                close(false);
              }}
            >
              <Shirt className="size-4" aria-hidden="true" />
              {assignLabel ?? "Fijar en el XI"}
            </Button>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
