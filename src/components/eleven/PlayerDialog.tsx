import { useMemo, useState } from "react";
import {
  formatMoney,
  POSITION_LABEL,
  type PlayerAvailability,
  type PositionGroup,
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
import { AvailabilityPicker, PlayerAvatar, PlayerFlag } from "./PlayerBits";
import { Loader2, Shirt, Sparkles } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Deriva las seis facetas del FC (ritmo, tiro, pase, regate, defensa, físico)
 * desde el OVR, la posición y la edad. Es una lectura determinista del
 * snapshot: misma entrada, mismos números, sin invocar servicios externos.
 */
function facetProfile(
  ovr: number,
  position: string,
  group: PositionGroup,
  age: number,
): { code: string; label: string; value: number }[] {
  const clamp = (n: number) => Math.min(99, Math.max(24, Math.round(n)));
  const prime = age <= 28 ? 1 : Math.max(0.88, 1 - (age - 28) * 0.018);
  const youth = age <= 21 ? 0.965 : 1;
  const base = ovr * prime * youth;
  const spread = Math.round(ovr * 0.42); // energía posicional repartida
  switch (position) {
    case "POR":
      return [
        { code: "DIV", label: "Estirada", value: clamp(base + spread * 0.4) },
        { code: "MAN", label: "Manos", value: clamp(base + spread * 0.2) },
        { code: "KIC", label: "Saque", value: clamp(base - spread * 0.5) },
        { code: "REF", label: "Reflejos", value: clamp(base + spread * 0.5) },
        { code: "SPD", label: "Velocidad", value: clamp(base - spread * 0.9) },
        { code: "POS", label: "Colocación", value: clamp(base + spread * 0.3) },
      ];
    case "DFC":
    case "LD":
    case "LI":
      return [
        { code: "RIT", label: "Ritmo", value: clamp(base + (position === "DFC" ? -spread * 0.6 : spread * 0.5)) },
        { code: "TIR", label: "Tiro", value: clamp(base - spread * 1.4) },
        { code: "PAS", label: "Pase", value: clamp(base - spread * 0.4) },
        { code: "REG", label: "Regate", value: clamp(base - spread * 0.8) },
        { code: "DEF", label: "Defensa", value: clamp(base + spread * (position === "DFC" ? 0.9 : 0.4)) },
        { code: "FIS", label: "Físico", value: clamp(base + spread * 0.6) },
      ];
    case "MCD":
    case "MC":
    case "MCO":
      return [
        { code: "RIT", label: "Ritmo", value: clamp(base + (position === "MCD" ? -spread * 0.4 : spread * 0.1)) },
        { code: "TIR", label: "Tiro", value: clamp(base + (position === "MCO" ? spread * 0.3 : -spread * 0.6)) },
        { code: "PAS", label: "Pase", value: clamp(base + spread * 0.7) },
        { code: "REG", label: "Regate", value: clamp(base + spread * 0.3) },
        { code: "DEF", label: "Defensa", value: clamp(base + (position === "MCD" ? spread * 0.3 : -spread * 1.2)) },
        { code: "FIS", label: "Físico", value: clamp(base - spread * 0.1) },
      ];
    case "EI":
    case "ED":
      return [
        { code: "RIT", label: "Ritmo", value: clamp(base + spread * 0.9) },
        { code: "TIR", label: "Tiro", value: clamp(base - spread * 0.1) },
        { code: "PAS", label: "Pase", value: clamp(base + spread * 0.1) },
        { code: "REG", label: "Regate", value: clamp(base + spread * 0.8) },
        { code: "DEF", label: "Defensa", value: clamp(base - spread * 1.6) },
        { code: "FIS", label: "Físico", value: clamp(base - spread * 0.5) },
      ];
    case "DC":
    default:
      return [
        { code: "RIT", label: "Ritmo", value: clamp(base + spread * 0.4) },
        { code: "TIR", label: "Tiro", value: clamp(base + spread * 1.0) },
        { code: "PAS", label: "Pase", value: clamp(base - spread * 0.9) },
        { code: "REG", label: "Regate", value: clamp(base - spread * 0.2) },
        { code: "DEF", label: "Defensa", value: clamp(base - spread * 1.8) },
        { code: "FIS", label: "Físico", value: clamp(base + spread * 0.7) },
      ];
  }
}

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
  const current = useMemo(
    () => (player ? draft ?? player.availability : null),
    [player, draft],
  );

  if (!player) return null;

  const facets = facetProfile(player.ovr, player.position, player.group, player.age);

  const close = (next: boolean) => {
    if (!next) setDraft(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92vh] overflow-y-auto scroll-thin gap-0 p-0 sm:max-w-md">
        {/* Cabecera estilo carta del FC */}
        <div className="relative overflow-hidden rounded-t-xl bg-gradient-to-br from-navy via-navy-deep to-pitch/40 p-5 text-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-14 size-44 rounded-full bg-white/5"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -left-8 size-36 rounded-full bg-brand/25"
          />
          <DialogHeader className="space-y-0">
            <DialogTitle className="sr-only">Ficha detallada de {player.name}</DialogTitle>
            <DialogDescription className="sr-only">
              Todos los datos del catálogo FC 27 de {player.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="relative flex items-center gap-4">
            <PlayerAvatar
              name={player.name}
              flag={player.flag}
              group={player.group}
              size="lg"
              photo={player.photo}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="num display text-3xl leading-none">{player.ovr}</span>
                <span className="display rounded-md bg-white/15 px-1.5 py-0.5 text-xs font-bold tracking-wide">
                  {player.position}
                </span>
              </div>
              <p className="display mt-1.5 truncate text-lg leading-tight">{player.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-white/75">
                <PlayerFlag flag={player.flag} className="h-4" />
                {player.nationality}
              </p>
            </div>
          </div>
          <p className="num relative mt-3 text-xl font-bold text-brand-bright">
            {formatMoney(player.value)}
          </p>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {/* Facetas del FC */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Atributos del FC 27
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {facets.map((facet) => (
                <div
                  key={facet.code}
                  className="rounded-lg border bg-muted/30 p-2 text-center"
                >
                  <p className="num display text-lg leading-none font-bold">{facet.value}</p>
                  <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
                    {facet.code} · {facet.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Todos los datos del catálogo */}
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {[
              { term: "Nacionalidad", value: `${player.flag} ${player.nationality}` },
              { term: "Posición", value: POSITION_LABEL[player.position] },
              { term: "Edad", value: `${player.age} años` },
              { term: "OVR", value: String(player.ovr) },
              { term: "Club de origen", value: player.realClub },
              { term: "Liga de origen", value: player.realLeague },
              { term: "Valoración", value: formatMoney(player.value) },
              { term: "Situación", value: player.availability },
            ].map((item) => (
              <div key={item.term} className="rounded-lg border p-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {item.term}
                </dt>
                <dd className="mt-0.5 truncate text-xs font-semibold">{item.value}</dd>
              </div>
            ))}
            <div className="col-span-2 rounded-lg border bg-muted/30 p-2.5">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Datos de origen
              </dt>
              <dd className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
                {player.fcVersion}
              </dd>
            </div>
          </dl>

          <Separator />

          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Situación en el mercado
            </p>
            {current ? (
              <AvailabilityPicker
                value={current}
                disabled={saving}
                onChange={(next) => setDraft(next)}
              />
            ) : null}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
