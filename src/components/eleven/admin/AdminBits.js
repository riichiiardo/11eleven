import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Small "?" affordance used across Administration: it explains what a field
 * means and how to configure it, so no label is ever ambiguous.
 */
export function Tip({ text, side = "right" }) {
    return (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("button", { type: "button", "aria-label": "M\u00E1s informaci\u00F3n sobre este campo", className: "inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary", children: _jsx(CircleHelp, { className: "size-3.5", "aria-hidden": "true" }) }) }), _jsx(TooltipContent, { side: side, className: "max-w-xs text-xs leading-relaxed", children: text })] }));
}
/** Label + inline tooltip: the label states WHAT, the tooltip explains HOW. */
export function FieldLabel({ htmlFor, children, tip, side, className, }) {
    return (_jsxs("span", { className: cn("flex items-center gap-1", className), children: [_jsx(Label, { htmlFor: htmlFor, className: "text-xs", children: children }), _jsx(Tip, { text: tip, side: side })] }));
}
