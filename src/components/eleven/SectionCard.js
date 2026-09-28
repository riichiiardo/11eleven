import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/lib/utils";
import { useNow } from "@/hooks/use-tournament";
import { formatClock, formatDuration } from "@/convex/rulesEngine";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
export function SectionCard({ title, icon: Icon, action, children, className, bodyClassName, accent = "brand", }) {
    const accentClass = {
        brand: "bg-brand",
        pitch: "bg-pitch",
        gold: "bg-gold",
        muted: "bg-muted-foreground/50",
    }[accent];
    return (_jsxs("section", { className: cn("card-soft flex flex-col overflow-hidden", className), children: [_jsxs("header", { className: "flex items-center justify-between gap-3 border-b px-4 py-3", children: [_jsxs("h2", { className: "flex items-center gap-2 text-sm font-bold tracking-tight", children: [_jsx("span", { "aria-hidden": "true", className: cn("h-4 w-1 rounded-full", accentClass) }), Icon ? _jsx(Icon, { className: "size-4 text-muted-foreground" }) : null, _jsx("span", { className: "display text-[13px]", children: title })] }), action ? (_jsxs(Link, { to: action.to, className: "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-primary hover:underline", children: [action.label, _jsx(ArrowRight, { className: "size-3.5", "aria-hidden": "true" })] })) : null] }), _jsx("div", { className: cn("flex-1 p-4", bodyClassName), children: children })] }));
}
export function StatTile({ icon: Icon, label, value, hint, tone = "brand", className, }) {
    const tones = {
        brand: "bg-brand/10 text-primary",
        pitch: "bg-pitch/12 text-emerald-700 dark:text-emerald-300",
        gold: "bg-gold/15 text-amber-700 dark:text-amber-300",
        rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
        slate: "bg-muted text-muted-foreground",
    }[tone];
    return (_jsxs("div", { className: cn("stat-card", className), children: [_jsx("span", { "aria-hidden": "true", className: cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tones), children: _jsx(Icon, { className: "size-4" }) }), _jsxs("span", { className: "min-w-0", children: [_jsx("span", { className: "num display block truncate text-lg leading-tight", children: value }), _jsx("span", { className: "block truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground", children: label }), hint ? (_jsx("span", { className: "mt-0.5 block truncate text-[11px] text-muted-foreground", children: hint })) : null] })] }));
}
export function Countdown({ target, label = "Cierra en", className, compact = false, }) {
    const now = useNow(1000);
    const remaining = target - now;
    const finished = remaining <= 0;
    return (_jsxs("span", { className: cn("num inline-flex items-center gap-1.5 tabular-nums", className), children: [label ? _jsx("span", { className: "text-muted-foreground", children: label }) : null, _jsx("span", { className: "font-semibold", children: finished
                    ? "cerrado"
                    : compact
                        ? formatDuration(remaining)
                        : formatClock(remaining) })] }));
}
export function ToneDot({ tone }) {
    const className = {
        open: "bg-emerald-500",
        progress: "bg-amber-500",
        locked: "bg-slate-400",
        blocked: "bg-rose-500",
    }[tone];
    return _jsx("span", { "aria-hidden": "true", className: cn("size-2 rounded-full", className) });
}
export function StatusPill({ children, className, }) {
    return (_jsx("span", { className: cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold", className), children: children }));
}
