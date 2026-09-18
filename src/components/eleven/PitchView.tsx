import { cn } from "@/lib/utils";
import {
  FORMATIONS,
  POSITION_LABEL,
  type FormationCode,
  type Lineup,
  type SquadPlayerView,
} from "@/convex/rulesEngine";
import { PlayerAvatar } from "./PlayerBits";
import { Plus } from "lucide-react";

function lastNameOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  return parts.slice(1).join(" ");
}

export function PitchView({
  formation,
  lineup,
  squad,
  mode = "view",
  highlight,
  onSlotClick,
  caption,
  className,
}: {
  formation: FormationCode;
  lineup: Lineup;
  squad: SquadPlayerView[];
  mode?: "view" | "edit";
  /** Slots the President can drop the selected player into. */
  highlight?: { valid: Set<string>; invalid: Set<string> };
  onSlotClick?: (slotId: string) => void;
  caption?: string;
  className?: string;
}) {
  const definition = FORMATIONS[formation];
  const byId = new Map(squad.map((player) => [player.playerId as string, player]));
  const assigned = lineup.slots
    .map((slot) => byId.get(slot.playerId ?? ""))
    .filter((player): player is SquadPlayerView => Boolean(player));
  const averageOvr = assigned.length
    ? Math.round((assigned.reduce((sum, p) => sum + p.ovr, 0) / assigned.length) * 10) / 10
    : 0;
  const captainId = assigned.length
    ? [...assigned].sort((a, b) => b.ovr - a.ovr)[0].playerId
    : null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2">
          <span className="display rounded-md bg-navy px-2 py-1 text-xs font-bold text-white">
            {definition.label}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {definition.shape}
          </span>
        </span>
        <span className="num text-[11px] font-semibold text-muted-foreground">
          OVR medio del XI · {averageOvr || "—"}
        </span>
      </div>

      <div
        role="group"
        aria-label={`Alineación titular en formación ${definition.label}`}
        className="pitch-surface relative w-full overflow-hidden rounded-xl ring-1 ring-emerald-900/20"
        style={{ aspectRatio: "4 / 5", minHeight: 420 }}
      >
        {/* Pitch markings */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-2.5 rounded-md border-2 border-white/22" />
        <span aria-hidden="true" className="pointer-events-none absolute left-2.5 right-2.5 top-1/2 border-t-2 border-white/18" />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 size-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/18"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2.5 left-1/2 h-[16%] w-[62%] -translate-x-1/2 border-2 border-b-0 border-white/18"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2.5 left-1/2 h-[7%] w-[32%] -translate-x-1/2 border-2 border-b-0 border-white/18"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-2.5 left-1/2 h-[14%] w-[54%] -translate-x-1/2 border-2 border-t-0 border-white/12"
        />

        {definition.slots.map((slot) => {
          const player = byId.get(
            lineup.slots.find((item) => item.slotId === slot.id)?.playerId ?? "",
          );
          const isCaptain = player && player.playerId === captainId;
          const state = highlight
            ? highlight.valid.has(slot.id)
              ? "valid"
              : highlight.invalid.has(slot.id)
                ? "invalid"
                : "neutral"
            : "neutral";

          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => onSlotClick?.(slot.id)}
              aria-label={
                player
                  ? `${player.name}, ${POSITION_LABEL[player.position]}, OVR ${player.ovr}. Ocupa la posición ${slot.label}.`
                  : `Posición ${POSITION_LABEL[slot.label]} vacía.`
              }
              className={cn(
                "absolute flex w-[74px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-lg p-1 transition",
                mode === "edit" && "hover:bg-white/10",
                state === "valid" && "bg-white/15 ring-2 ring-emerald-300",
                state === "invalid" && "opacity-45",
              )}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            >
              {player ? (
                <>
                  <span className="relative">
                    <PlayerAvatar
                      name={player.name}
                      flag={player.flag}
                      group={player.group}
                      size="sm"
                    />
                    <span
                      className={cn(
                        "num absolute -right-3 -top-1 rounded-md bg-white px-1 py-px text-[10px] font-bold text-slate-900 shadow-sm",
                      )}
                    >
                      {player.ovr}
                    </span>
                    {isCaptain ? (
                      <span className="display absolute -left-2.5 -top-1 rounded-md bg-gold px-1 py-px text-[9px] font-extrabold text-amber-950 shadow-sm">
                        C
                      </span>
                    ) : null}
                  </span>
                  <span className="w-full truncate rounded-md bg-navy-deep/80 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
                    {lastNameOf(player.name)}
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-white/75">
                    {slot.label}
                  </span>
                </>
              ) : (
                <>
                  <span
                    aria-hidden="true"
                    className="flex size-10 items-center justify-center rounded-full border-2 border-dashed border-white/45 text-white/70"
                  >
                    <Plus className="size-4" />
                  </span>
                  <span className="w-full truncate rounded-md bg-black/25 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white/80">
                    {slot.label}
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-white/60">
                    vacío
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {caption ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{caption}</p>
      ) : null}

      {/* Text alternative for the lineup (WCAG 1.1.1) */}
      <ol className="sr-only">
        {definition.slots.map((slot) => {
          const player = byId.get(
            lineup.slots.find((item) => item.slotId === slot.id)?.playerId ?? "",
          );
          return (
            <li key={slot.id}>
              {POSITION_LABEL[slot.label]}: {player ? player.name : "sin asignar"}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
