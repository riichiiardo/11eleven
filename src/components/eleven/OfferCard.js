import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { OFFER_STATUS_META } from "@/convex/marketEngine";
import { formatMoney } from "@/convex/rulesEngine";
import { useMarketActions } from "@/hooks/use-market-actions";
import { formatDateTime, relativeTime } from "@/lib/errors";
import { useNow } from "@/hooks/use-tournament";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { RuleCheckList } from "./RuleCheckList";
import { Crest } from "./Crest";
import { OfferStatusPill } from "./OfferBits";
import { useQuery } from "convex/react";
import { ArrowRight, BadgeEuro, Check, ClipboardCheck, Loader2, MessageSquare, Trash2, } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * One negotiation. The card always states who is involved, what changes hands,
 * which side the President is on and what happens if he presses the button —
 * including the *why* when the engine refuses (prompt §41: never "Error 409").
 */
export function OfferCard({ offer }) {
    const now = useNow(30000);
    const { respondOffer, cancelOffer, busyKey } = useMarketActions();
    const [validationOpen, setValidationOpen] = useState(false);
    const meta = OFFER_STATUS_META[offer.status];
    const awaitingMe = offer.canRespond;
    const decided = offer.status === "aceptada" ||
        offer.status === "reservada" ||
        offer.status === "ejecutada";
    return (_jsxs("article", { className: cn("card-soft flex flex-col gap-3 p-3.5", awaitingMe && "border-amber-500/45", offer.status === "invalidada" && "border-rose-500/45"), children: [_jsxs("header", { className: "flex flex-wrap items-start justify-between gap-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(OfferStatusPill, { status: offer.status }), _jsx("span", { className: "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", children: offer.type === "trade" ? "Intercambio" : "Operación en efectivo" })] }), _jsxs("p", { className: "mt-1.5 text-xs text-muted-foreground", children: [offer.bidderIsMe ? "La enviaste" : `${offer.bidderNickname} la envió`, " \u00B7", " ", relativeTime(offer.updatedAt, now), offer.executedAt ? ` · ejecutada ${formatDateTime(offer.executedAt)}` : ""] })] }), awaitingMe ? (_jsx("span", { className: "inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-200", children: "Requiere tu respuesta" })) : null] }), _jsxs("div", { className: "grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center", children: [_jsx(ClubBlock, { nickname: offer.bidderNickname, clubName: offer.bidderClubName, colors: offer.bidderClubColors, isMe: offer.bidderIsMe }), _jsx("span", { "aria-hidden": "true", className: "mx-auto flex size-8 items-center justify-center rounded-full border bg-muted text-muted-foreground", children: _jsx(ArrowRight, { className: "size-4" }) }), _jsx(ClubBlock, { nickname: offer.sellerNickname ?? "Agente libre", clubName: offer.sellerClubName ?? "Sin club en el torneo", colors: offer.sellerClubColors ?? ["#334155", "#0f172a"], isMe: offer.side === "recibida" && !offer.bidderIsMe })] }), _jsxs("div", { className: "grid gap-2 sm:grid-cols-2", children: [_jsx(PlayerColumn, { title: "Ofrece", players: offer.offered, empty: "Sin jugadores: solo dinero." }), _jsx(PlayerColumn, { title: "Solicita", players: offer.requested, empty: "Sin jugadores solicitados." })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-2.5", children: [_jsxs("span", { className: "num inline-flex items-center gap-1.5 text-sm font-bold", children: [_jsx(BadgeEuro, { "aria-hidden": "true", className: "size-4 text-muted-foreground" }), formatMoney(offer.cash)] }), _jsx("span", { className: "text-[11px] text-muted-foreground", children: offer.bidderIsMe
                            ? "Salen de tu presupuesto si se ejecuta"
                            : "Entran al presupuesto del club vendedor" })] }), offer.message ? (_jsxs("p", { className: "flex gap-2 rounded-lg border border-border bg-card p-2.5 text-xs leading-relaxed text-muted-foreground", children: [_jsx(MessageSquare, { className: "mt-0.5 size-3.5 shrink-0", "aria-hidden": "true" }), offer.message] })) : null, offer.blockers.length > 0 && !decided ? (_jsxs("p", { className: "rounded-lg border border-amber-500/35 bg-amber-500/[0.07] p-2.5 text-xs leading-relaxed text-amber-800 dark:text-amber-200", children: [meta.description, " ", offer.blockers[0]] })) : null, offer.invalidReason ? (_jsx("p", { className: "rounded-lg border border-rose-500/35 bg-rose-500/[0.07] p-2.5 text-xs leading-relaxed text-rose-700 dark:text-rose-300", children: offer.invalidReason })) : null, _jsxs("footer", { className: "flex flex-wrap items-center gap-2", children: [offer.canRespond ? (_jsxs(_Fragment, { children: [_jsxs(Button, { type: "button", className: "min-h-11", disabled: busyKey !== null, onClick: () => respondOffer(offer.id, "aceptar"), children: [busyKey === `aceptar-${offer.id}` ? (_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" })) : (_jsx(Check, { className: "size-4", "aria-hidden": "true" })), "Aceptar"] }), _jsx(Button, { type: "button", variant: "outline", className: "min-h-11", disabled: busyKey !== null, onClick: () => respondOffer(offer.id, "rechazar"), children: "Rechazar" })] })) : null, offer.canCancel ? (_jsxs(Button, { type: "button", variant: "ghost", className: "min-h-11 text-muted-foreground", disabled: busyKey !== null, onClick: () => cancelOffer(offer.id), children: [busyKey === `cancelar-${offer.id}` ? (_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" })) : (_jsx(Trash2, { className: "size-4", "aria-hidden": "true" })), "Cancelar operaci\u00F3n"] })) : null, _jsxs(Button, { type: "button", variant: "outline", className: "min-h-11 sm:ml-auto", onClick: () => setValidationOpen(true), children: [_jsx(ClipboardCheck, { className: "size-4", "aria-hidden": "true" }), "Ver validaci\u00F3n"] })] }), !awaitingMe && offer.status === "enviada" && offer.side === "enviada" ? (_jsxs("p", { className: "text-[11px] text-muted-foreground", children: ["Esperando la respuesta de ", offer.sellerNickname ?? "el club", ". Si no responde, la operaci\u00F3n expira sin efecto."] })) : null, _jsx(ValidationDialog, { offerId: offer.id, open: validationOpen, onOpenChange: setValidationOpen, status: offer.status })] }));
}
function ValidationDialog({ offerId, open, onOpenChange, status, }) {
    const report = useQuery(api.market.validateOffer, open ? { offerId } : "skip");
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-h-[90vh] overflow-y-auto scroll-thin sm:max-w-2xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { className: "display text-base", children: "Validaci\u00F3n final de la operaci\u00F3n" }), _jsxs(DialogDescription, { children: [OFFER_STATUS_META[status].description, " Todo vuelve a comprobarse contra el estado actual de ambas plantillas justo antes de aplicar los cambios."] })] }), report === undefined ? (_jsxs("p", { className: "flex items-center gap-2 text-sm text-muted-foreground", children: [_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" }), "Comprobando jugadores, presupuestos y reglas\u2026"] })) : report === null ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "No tienes acceso a esta operaci\u00F3n." })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: cn("rounded-lg border p-2.5 text-sm font-semibold", report.passed
                                ? "border-emerald-500/35 bg-emerald-500/[0.07] text-emerald-800 dark:text-emerald-200"
                                : "border-rose-500/35 bg-rose-500/[0.07] text-rose-700 dark:text-rose-300"), children: report.passed
                                ? "La operación supera todas las comprobaciones: está lista para ejecutarse."
                                : "La operación no puede ejecutarse en este momento." }), _jsx(Separator, {}), _jsx(RuleCheckList, { checks: report.checks, variant: "full" })] }))] }) }));
}
function ClubBlock({ nickname, clubName, colors, isMe, }) {
    return (_jsxs("div", { className: "flex min-w-0 items-center gap-2.5 rounded-lg border p-2.5", children: [_jsx(Crest, { name: clubName, shortName: initialsOf(clubName), colors: colors, size: "sm" }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-sm font-bold", children: clubName }), _jsxs("p", { className: "truncate text-[11px] text-muted-foreground", children: [nickname, isMe ? " · tú" : ""] })] })] }));
}
function PlayerColumn({ title, players, empty, }) {
    return (_jsxs("div", { className: "rounded-lg border p-2.5", children: [_jsx("p", { className: "text-[10px] font-bold uppercase tracking-wide text-muted-foreground", children: title }), players.length === 0 ? (_jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: empty })) : (_jsx("ul", { className: "mt-1 flex flex-col gap-1", children: players.map((player) => (_jsxs("li", { className: "flex items-baseline justify-between gap-2", children: [_jsxs("span", { className: "truncate text-sm font-semibold", children: [player.flag, " ", player.name] }), _jsxs("span", { className: "num shrink-0 text-[11px] text-muted-foreground", children: [player.position, " \u00B7 OVR ", player.ovr, " \u00B7 ", formatMoney(player.value)] })] }, player.playerId))) }))] }));
}
function initialsOf(name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return "??";
    if (parts.length === 1)
        return parts[0].slice(0, 3).toUpperCase();
    return parts
        .slice(0, 3)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
}
