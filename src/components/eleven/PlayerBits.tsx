import { cn } from "@/lib/utils";
import {
  AVAILABILITY_META,
  AVAILABILITIES,
  GROUP_ACCENT,
  POSITION_LABEL,
  type PlayerAvailability,
  type Position,
  type PositionGroup,
} from "@/convex/rulesEngine";

const GROUP_GRADIENT: Record<PositionGroup, string> = {
  GK: "from-amber-400 to-amber-600",
  DEF: "from-sky-500 to-blue-700",
  MID: "from-emerald-400 to-emerald-700",
  FWD: "from-rose-400 to-rose-700",
};

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const AVATAR_SIZES = {
  xs: "size-8 text-[10px]",
  sm: "size-10 text-xs",
  md: "size-14 text-base",
  lg: "size-20 text-xl",
} as const;

export function PlayerAvatar({
  name,
  flag,
  group,
  size = "md",
  className,
}: {
  name: string;
  flag?: string;
  group: PositionGroup;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "display inline-flex items-center justify-center rounded-full bg-gradient-to-br text-white ring-2 ring-white dark:ring-white/20",
          GROUP_GRADIENT[group],
          AVATAR_SIZES[size],
        )}
      >
        {initialsOf(name)}
      </span>
      {flag ? (
        <span
          className="absolute -bottom-0.5 -left-0.5 rounded-full bg-white px-[2px] text-[10px] leading-none shadow-sm dark:bg-card"
          aria-hidden="true"
        >
          {flag}
        </span>
      ) : null}
    </span>
  );
}

export function PositionPill({
  position,
  group,
  className,
}: {
  position: Position;
  group: PositionGroup;
  className?: string;
}) {
  return (
    <span
      title={POSITION_LABEL[position]}
      className={cn(
        "display inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide",
        GROUP_ACCENT[group],
        className,
      )}
    >
      {position}
    </span>
  );
}

export function OvrBadge({ ovr, className }: { ovr: number; className?: string }) {
  const tone =
    ovr >= 87
      ? "bg-gold/20 text-amber-800 dark:text-amber-200 ring-gold/40"
      : ovr >= 82
        ? "bg-brand/15 text-primary ring-brand/30"
        : "bg-muted text-muted-foreground ring-border";
  return (
    <span
      className={cn(
        "num display inline-flex min-w-9 items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-bold ring-1",
        tone,
        className,
      )}
    >
      {ovr}
    </span>
  );
}

export function AvailabilityBadge({
  availability,
  className,
  showLabel = true,
}: {
  availability: PlayerAvailability;
  className?: string;
  showLabel?: boolean;
}) {
  const meta = AVAILABILITY_META[availability];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
        meta.className,
        className,
      )}
      title={meta.description}
    >
      <span aria-hidden="true" className="text-xs leading-none">
        {meta.symbol}
      </span>
      {showLabel ? <span>{meta.label}</span> : <span className="sr-only">{meta.label}</span>}
    </span>
  );
}

/**
 * Availability is a radio group: icon + text + colour, keyboard operable and
 * never colour-only (WCAG 2.2 AA).
 */
export function AvailabilityPicker({
  value,
  onChange,
  disabled,
  name = "availability",
}: {
  value: PlayerAvailability;
  onChange: (next: PlayerAvailability) => void;
  disabled?: boolean;
  name?: string;
}) {
  return (
    <div role="radiogroup" aria-label="Situación del jugador" className="grid gap-2 sm:grid-cols-2">
      {AVAILABILITIES.map((option) => {
        const meta = AVAILABILITY_META[option];
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            name={name}
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              "flex min-h-11 items-start gap-2 rounded-lg border p-2.5 text-left transition-colors",
              selected
                ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                : "border-border bg-card hover:bg-accent",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <span aria-hidden="true" className="mt-0.5 text-sm leading-none">
              {meta.symbol}
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold">{meta.label}</span>
              <span className="text-[11px] leading-snug text-muted-foreground">
                {meta.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
