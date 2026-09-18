import { cn } from "@/lib/utils";
import { GROUP_LABEL, type PositionGroup, type RuleCheck } from "@/convex/rulesEngine";
import { AlertTriangle, Check, Lock, X } from "lucide-react";
import { Link } from "react-router";

function CheckIcon({ passed }: { passed: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
        passed
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-rose-500/15 text-rose-700 dark:text-rose-300",
      )}
    >
      {passed ? <Check className="size-3.5" /> : <X className="size-3.5" />}
    </span>
  );
}

export function RuleCheckList({
  checks,
  variant = "compact",
  className,
}: {
  checks: RuleCheck[];
  variant?: "compact" | "full";
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-col", variant === "full" ? "gap-3" : "gap-2", className)}>
      {checks.map((check) => (
        <li
          key={check.id}
          className={cn(
            "flex items-start gap-2.5 rounded-lg border p-3",
            check.passed
              ? "border-border bg-card"
              : "border-rose-500/30 bg-rose-500/[0.04]",
          )}
        >
          <CheckIcon passed={check.passed} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-semibold">
                {check.label}
                <span className="sr-only">
                  {check.passed ? ": cumple" : ": incumple"}
                </span>
              </p>
              <p className="num text-xs font-semibold text-muted-foreground">{check.value}</p>
            </div>
            {variant === "full" ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {check.detail}
              </p>
            ) : null}
            {variant === "full" ? (
              <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {check.ruleRef}
              </p>
            ) : null}
            {!check.passed && check.action ? (
              <Link
                to={check.action.to}
                className="mt-1.5 inline-flex text-xs font-semibold text-primary hover:underline"
              >
                {check.action.label}
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function LockedNotice({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-slate-400/30 bg-slate-500/[0.06] p-3",
        className,
      )}
    >
      <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-500" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function WarningNotice({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3",
        className,
      )}
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/** Squad shape vs the tournament range for one position group. */
export function GroupMeter({
  group,
  count,
  min,
  max,
  className,
}: {
  group: PositionGroup;
  count: number;
  min: number;
  max: number;
  className?: string;
}) {
  const passed = count >= min && count <= max;
  const fill = Math.max(6, Math.min(100, (count / Math.max(max, 1)) * 100));
  const minMark = Math.min(100, (min / Math.max(max, 1)) * 100);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {GROUP_LABEL[group]}
        </span>
        <span className="num text-xs font-semibold">
          {count}
          <span className="text-muted-foreground">
            {" "}
            / {min}-{max}
          </span>
        </span>
      </div>
      <div
        className="relative h-2 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${GROUP_LABEL[group]}: ${count} jugadores, rango permitido ${min} a ${max}`}
      >
        <div
          className={cn("h-full rounded-full", passed ? "bg-pitch" : "bg-rose-500")}
          style={{ width: `${fill}%` }}
        />
        <span
          aria-hidden="true"
          className="absolute top-0 h-full w-px bg-foreground/30"
          style={{ left: `${minMark}%` }}
        />
      </div>
    </div>
  );
}
