import type { DraftTurnView } from "@/convex/appTypes";
import { DRAFT_STATUS_META, type DraftStatus } from "@/convex/draftEngine";
import { formatMoney } from "@/convex/rulesEngine";
import { Crest } from "./Crest";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

/**
 * Draft state is symbol + text + colour, never colour alone (WCAG 2.2 AA).
 */
export function DraftStatusPill({
  status,
  className,
}: {
  status: DraftStatus | null;
  className?: string;
}) {
  if (!status) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground",
          className,
        )}
      >
        <span aria-hidden="true">○</span>
        Sin preparar
      </span>
    );
  }
  const meta = DRAFT_STATUS_META[status];
  return (
    <span
      title={meta.hint}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        meta.className,
        className,
      )}
    >
      <span aria-hidden="true" className="text-xs leading-none">
        {meta.symbol}
      </span>
      {meta.label}
    </span>
  );
}

/** The turn order as a readable, focusable sequence (not a colour code). */
export function TurnStrip({
  order,
  showBudget = true,
  className,
}: {
  order: DraftTurnView[];
  showBudget?: boolean;
  className?: string;
}) {
  if (order.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay un orden de turnos. Administración lo genera al preparar el
        draft.
      </p>
    );
  }
  return (
    <ol className={cn("flex flex-wrap items-stretch gap-2", className)}>
      {order.map((turn, index) => (
        <li key={turn.presidentId} className="flex items-center gap-2">
          {index > 0 ? (
            <ArrowRight
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground/60"
            />
          ) : null}
          <div
            className={cn(
              "flex min-h-16 items-center gap-2.5 rounded-xl border px-3 py-2",
              turn.isCurrent
                ? "border-emerald-500/50 bg-emerald-500/[0.08] ring-1 ring-emerald-500/30"
                : "border-border bg-card",
            )}
          >
            <span className="num flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-bold text-muted-foreground">
              {index + 1}
            </span>
            <Crest
              name={turn.clubName}
              shortName={turn.clubShortName}
              colors={turn.clubColors}
              size="sm"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">
                {turn.nickname}
                {turn.isMe ? (
                  <span className="ml-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    tú
                  </span>
                ) : null}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {turn.clubName}
              </p>
              <p className="num truncate text-[11px] text-muted-foreground">
                {turn.picks} fichaje(s)
                {showBudget ? ` · ${formatMoney(turn.budget)}` : ""}
                {turn.isCurrent ? " · turno actual" : ""}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
