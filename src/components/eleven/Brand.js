import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/lib/utils";
import { useId } from "react";
/** 11Eleven mark: two slanted strokes (the "11") inside a navy-to-blue tile. */
export function ElevenMark({ className, tone = "brand", }) {
    // useId returns colons, which are unsafe inside `url(#id)` references.
    const gradientId = `eleven-mark-${useId().replace(/:/g, "")}`;
    return (_jsxs("svg", { viewBox: "0 0 48 48", className: cn("size-9 shrink-0", className), role: "img", "aria-label": "11Eleven", children: [_jsx("defs", { children: _jsxs("linearGradient", { id: gradientId, x1: "0", y1: "0", x2: "1", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: tone === "brand" ? "#2f6bff" : "#ffffff" }), _jsx("stop", { offset: "100%", stopColor: tone === "brand" ? "#0b1a30" : "#c7d7f5" })] }) }), _jsx("rect", { width: "48", height: "48", rx: "11", fill: `url(#${gradientId})` }), _jsx("path", { d: "M14.5 34.5 L20.2 13.5 h5.1 L19.6 34.5 z", fill: "#fff" }), _jsx("path", { d: "M26.2 34.5 L31.9 13.5 h5.1 L31.3 34.5 z", fill: "#fff", opacity: "0.82" })] }));
}
export function BrandLockup({ className, subtitle = "Fantasy Football Manager", tone = "light", }) {
    return (_jsxs("span", { className: cn("flex items-center gap-2.5", className), children: [_jsx(ElevenMark, {}), _jsxs("span", { className: "flex flex-col leading-none", children: [_jsxs("span", { className: cn("display text-xl tracking-tight", tone === "light" ? "text-white" : "text-foreground"), children: ["11", _jsx("span", { className: "text-brand-bright", children: "Eleven" })] }), _jsx("span", { className: cn("mt-1 text-[9px] font-semibold uppercase tracking-[0.22em]", tone === "light" ? "text-white/55" : "text-muted-foreground"), children: subtitle })] })] }));
}
