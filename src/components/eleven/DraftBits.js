import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { DRAFT_STATUS_META } from "@/convex/draftEngine";
import { formatMoney } from "@/convex/rulesEngine";
import { Crest } from "./Crest";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
/**
 * Draft state is symbol + text + colour, never colour alone (WCAG 2.2 AA).
 */
export function DraftStatusPill({ status, className, }) {
    if (!status) {
        return (_jsxs("span", { className: cn("inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground", className), children: [_jsx("span", { "aria-hidden": "true", children: "\u25CB" }), "Sin preparar"] }));
    }
    const meta = DRAFT_STATUS_META[status];
    return (_jsxs("span", { title: meta.hint, className: cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold", meta.className, className), children: [_jsx("span", { "aria-hidden": "true", className: "text-xs leading-none", children: meta.symbol }), meta.label] }));
}
/** The turn order as a readable, focusable sequence (not a colour code). */
export function TurnStrip({ order, showBudget = true, className, }) {
    if (order.length === 0) {
        return (_jsx("p", { className: "text-sm text-muted-foreground", children: "Todav\u00EDa no hay un orden de turnos. Administraci\u00F3n lo genera al preparar el draft." }));
    }
    return (_jsx("ol", { className: cn("flex flex-wrap items-stretch gap-2", className), children: order.map((turn, index) => (_jsxs("li", { className: "flex items-center gap-2", children: [index > 0 ? (_jsx(ArrowRight, { "aria-hidden": "true", className: "size-4 shrink-0 text-muted-foreground/60" })) : null, _jsxs("div", { className: cn("flex min-h-16 items-center gap-2.5 rounded-xl border px-3 py-2", turn.isCurrent
                        ? "border-emerald-500/50 bg-emerald-500/[0.08] ring-1 ring-emerald-500/30"
                        : "border-border bg-card"), children: [_jsx("span", { className: "num flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-bold text-muted-foreground", children: index + 1 }), _jsx(Crest, { name: turn.clubName, shortName: turn.clubShortName, colors: turn.clubColors, size: "sm" }), _jsxs("div", { className: "min-w-0", children: [_jsxs("p", { className: "truncate text-sm font-bold", children: [turn.nickname, turn.isMe ? (_jsx("span", { className: "ml-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary", children: "t\u00FA" })) : null] }), _jsx("p", { className: "truncate text-[11px] text-muted-foreground", children: turn.clubName }), _jsxs("p", { className: "num truncate text-[11px] text-muted-foreground", children: [turn.picks, " fichaje(s)", showBudget ? ` · ${formatMoney(turn.budget)}` : "", turn.isCurrent ? " · turno actual" : ""] })] })] })] }, turn.presidentId))) }));
}
