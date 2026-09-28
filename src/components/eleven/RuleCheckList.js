import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/lib/utils";
import { GROUP_LABEL } from "@/convex/rulesEngine";
import { AlertTriangle, Check, Lock, X } from "lucide-react";
import { Link } from "react-router";
function CheckIcon({ passed }) {
    return (_jsx("span", { "aria-hidden": "true", className: cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", passed
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            : "bg-rose-500/15 text-rose-700 dark:text-rose-300"), children: passed ? _jsx(Check, { className: "size-3.5" }) : _jsx(X, { className: "size-3.5" }) }));
}
export function RuleCheckList({ checks, variant = "compact", className, }) {
    return (_jsx("ul", { className: cn("flex flex-col", variant === "full" ? "gap-3" : "gap-2", className), children: checks.map((check) => (_jsxs("li", { className: cn("flex items-start gap-2.5 rounded-lg border p-3", check.passed
                ? "border-border bg-card"
                : "border-rose-500/30 bg-rose-500/[0.04]"), children: [_jsx(CheckIcon, { passed: check.passed }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1", children: [_jsxs("p", { className: "text-sm font-semibold", children: [check.label, _jsx("span", { className: "sr-only", children: check.passed ? ": cumple" : ": incumple" })] }), _jsx("p", { className: "num text-xs font-semibold text-muted-foreground", children: check.value })] }), variant === "full" ? (_jsx("p", { className: "mt-1 text-xs leading-relaxed text-muted-foreground", children: check.detail })) : null, variant === "full" ? (_jsx("p", { className: "mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", children: check.ruleRef })) : null, !check.passed && check.action ? (_jsx(Link, { to: check.action.to, className: "mt-1.5 inline-flex text-xs font-semibold text-primary hover:underline", children: check.action.label })) : null] })] }, check.id))) }));
}
export function LockedNotice({ title, description, className, }) {
    return (_jsxs("div", { className: cn("flex items-start gap-2.5 rounded-lg border border-slate-400/30 bg-slate-500/[0.06] p-3", className), children: [_jsx(Lock, { "aria-hidden": "true", className: "mt-0.5 size-4 shrink-0 text-slate-500" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold", children: title }), _jsx("p", { className: "mt-0.5 text-xs leading-relaxed text-muted-foreground", children: description })] })] }));
}
export function WarningNotice({ title, description, className, }) {
    return (_jsxs("div", { className: cn("flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3", className), children: [_jsx(AlertTriangle, { "aria-hidden": "true", className: "mt-0.5 size-4 shrink-0 text-amber-600" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold", children: title }), _jsx("p", { className: "mt-0.5 text-xs leading-relaxed text-muted-foreground", children: description })] })] }));
}
/** Squad shape vs the tournament range for one position group. */
export function GroupMeter({ group, count, min, max, className, }) {
    const passed = count >= min && count <= max;
    const fill = Math.max(6, Math.min(100, (count / Math.max(max, 1)) * 100));
    const minMark = Math.min(100, (min / Math.max(max, 1)) * 100);
    return (_jsxs("div", { className: cn("flex flex-col gap-1.5", className), children: [_jsxs("div", { className: "flex items-baseline justify-between gap-2", children: [_jsx("span", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: GROUP_LABEL[group] }), _jsxs("span", { className: "num text-xs font-semibold", children: [count, _jsxs("span", { className: "text-muted-foreground", children: [" ", "/ ", min, "-", max] })] })] }), _jsxs("div", { className: "relative h-2 overflow-hidden rounded-full bg-muted", role: "img", "aria-label": `${GROUP_LABEL[group]}: ${count} jugadores, rango permitido ${min} a ${max}`, children: [_jsx("div", { className: cn("h-full rounded-full", passed ? "bg-pitch" : "bg-rose-500"), style: { width: `${fill}%` } }), _jsx("span", { "aria-hidden": "true", className: "absolute top-0 h-full w-px bg-foreground/30", style: { left: `${minMark}%` } })] })] }));
}
