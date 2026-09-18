import { cn } from "@/lib/utils";
import { useNow } from "@/hooks/use-tournament";
import { formatClock, formatDuration } from "@/convex/rulesEngine";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

export function SectionCard({
  title,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
  accent = "brand",
}: {
  title: string;
  icon?: LucideIcon;
  action?: { label: string; to: string };
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  accent?: "brand" | "pitch" | "gold" | "muted";
}) {
  const accentClass = {
    brand: "bg-brand",
    pitch: "bg-pitch",
    gold: "bg-gold",
    muted: "bg-muted-foreground/50",
  }[accent];

  return (
    <section className={cn("card-soft flex flex-col overflow-hidden", className)}>
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <span aria-hidden="true" className={cn("h-4 w-1 rounded-full", accentClass)} />
          {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
          <span className="display text-[13px]">{title}</span>
        </h2>
        {action ? (
          <Link
            to={action.to}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-primary hover:underline"
          >
            {action.label}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </header>
      <div className={cn("flex-1 p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "brand",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: "brand" | "pitch" | "gold" | "rose" | "slate";
  className?: string;
}) {
  const tones = {
    brand: "bg-brand/10 text-primary",
    pitch: "bg-pitch/12 text-emerald-700 dark:text-emerald-300",
    gold: "bg-gold/15 text-amber-700 dark:text-amber-300",
    rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    slate: "bg-muted text-muted-foreground",
  }[tone];

  return (
    <div className={cn("stat-card", className)}>
      <span
        aria-hidden="true"
        className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tones)}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="num display block truncate text-lg leading-tight">{value}</span>
        <span className="block truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {hint ? (
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{hint}</span>
        ) : null}
      </span>
    </div>
  );
}

export function Countdown({
  target,
  label = "Cierra en",
  className,
  compact = false,
}: {
  target: number;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  const now = useNow(1000);
  const remaining = target - now;
  const finished = remaining <= 0;

  return (
    <span className={cn("num inline-flex items-center gap-1.5 tabular-nums", className)}>
      {label ? <span className="text-muted-foreground">{label}</span> : null}
      <span className="font-semibold">
        {finished
          ? "cerrado"
          : compact
            ? formatDuration(remaining)
            : formatClock(remaining)}
      </span>
    </span>
  );
}

export function ToneDot({ tone }: { tone: "open" | "progress" | "locked" | "blocked" }) {
  const className = {
    open: "bg-emerald-500",
    progress: "bg-amber-500",
    locked: "bg-slate-400",
    blocked: "bg-rose-500",
  }[tone];
  return <span aria-hidden="true" className={cn("size-2 rounded-full", className)} />;
}

export function StatusPill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}
