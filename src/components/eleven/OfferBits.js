import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { OFFER_STATUS_META } from "@/convex/marketEngine";
import { cn } from "@/lib/utils";
/**
 * Offer state is communicated with symbol + text + colour, never colour alone
 * (WCAG 2.2 AA, prompt §43).
 */
export function OfferStatusPill({ status, className, }) {
    const meta = OFFER_STATUS_META[status];
    return (_jsxs("span", { title: meta.description, className: cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold", meta.className, className), children: [_jsx("span", { "aria-hidden": "true", className: "text-xs leading-none", children: meta.symbol }), meta.label] }));
}
