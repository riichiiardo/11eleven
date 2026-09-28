import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { formatMoney } from "@/convex/rulesEngine";
import { useMarketActions } from "@/hooks/use-market-actions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { RuleCheckList } from "./RuleCheckList";
import { PlayerAvatar, PositionPill } from "./PlayerBits";
import { useQuery } from "convex/react";
import { ArrowLeftRight, BadgeEuro, Coins, Loader2, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The offer builder. It never waits for "Guardar" to validate: the same rule
 * engine that guards the server also drives the live preview, so the President
 * sees exactly which rule blocks the operation and what he can do about it.
 */
export function OfferDialog({ player, squad, budget, open, onOpenChange, }) {
    const { sendOffer, busyKey } = useMarketActions();
    const isFree = player.kind === "libre";
    const [mode, setMode] = useState("cash");
    const [offeredId, setOfferedId] = useState("");
    const [cashInput, setCashInput] = useState(() => player.kind === "libre" ? (player.value / 1000000).toFixed(1) : "0");
    const [message, setMessage] = useState("");
    const cash = Math.max(0, Math.round((Number(cashInput) || 0) * 1000000));
    const offeredPlayerIds = useMemo(() => mode === "trade" && offeredId
        ? [offeredId]
        : [], [mode, offeredId]);
    const guidance = useQuery(api.market.guidance, open
        ? {
            requestedPlayerIds: [player.playerId],
            offeredPlayerIds,
            cash,
        }
        : "skip");
    const tradeNeedsPlayer = mode === "trade" && offeredPlayerIds.length === 0;
    const blocked = guidance ? !guidance.passed : true;
    const canSubmit = !blocked && !tradeNeedsPlayer && busyKey !== "crear";
    const committedInOffers = guidance
        ? Math.max(0, budget.available - guidance.spendable)
        : 0;
    const handleSubmit = async () => {
        // A free agent has no counterpart, so the operation always pays his exact
        // signing cost; a trade pays whatever the President typed.
        const result = await sendOffer({
            requestedPlayerIds: [player.playerId],
            offeredPlayerIds,
            cash: isFree ? player.value : cash,
            message: message.trim() || undefined,
        });
        if (result)
            onOpenChange(false);
    };
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-h-[92vh] overflow-y-auto scroll-thin sm:max-w-2xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { className: "display text-base", children: isFree ? `Fichar a ${player.name}` : `Oferta por ${player.name}` }), _jsx(DialogDescription, { children: player.ownerClubName
                                ? `Presidente destinatario: ${player.ownerNickname ?? "sin asignar"} · ${player.ownerClubName}`
                                : "Agente libre: no requiere acuerdo entre Presidentes." })] }), _jsxs("div", { className: "flex items-center gap-3 rounded-xl border bg-gradient-to-br from-navy to-navy-deep p-3.5 text-white", children: [_jsx(PlayerAvatar, { name: player.name, flag: player.flag, group: player.group, size: "lg", photo: player.photo }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "display truncate text-base", children: player.name }), _jsxs("div", { className: "mt-1 flex flex-wrap items-center gap-2", children: [_jsx(PositionPill, { position: player.position, group: player.group }), _jsxs("span", { className: "num rounded-md bg-white/15 px-2 py-0.5 text-xs font-bold", children: ["OVR ", player.ovr] }), _jsxs("span", { className: "num text-xs text-white/75", children: [player.age, " a\u00F1os"] })] })] }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "text-[10px] font-bold uppercase tracking-wide text-white/60", children: isFree ? "Coste de firma" : "Valoración" }), _jsx("p", { className: "num text-xl font-bold text-brand-bright", children: formatMoney(player.value) })] })] }), _jsxs("dl", { className: "grid grid-cols-2 gap-3 text-sm sm:grid-cols-3", children: [_jsx(Money, { label: "Presupuesto disponible", value: formatMoney(budget.available) }), _jsx(Money, { label: "Comprometido en operaciones", value: formatMoney(committedInOffers) }), _jsx(Money, { label: "Oferta m\u00E1xima", value: guidance ? formatMoney(guidance.guidance.maxOffer) : "—" })] }), !isFree ? (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: "C\u00F3mo quieres negociar" }), _jsxs("div", { role: "radiogroup", "aria-label": "Tipo de operaci\u00F3n", className: "grid gap-2 sm:grid-cols-2", children: [_jsx(ModeButton, { active: mode === "cash", icon: BadgeEuro, title: "Solo dinero", description: "Ofreces presupuesto al club de este jugador.", onClick: () => setMode("cash") }), _jsx(ModeButton, { active: mode === "trade", icon: ArrowLeftRight, title: "Intercambio", description: "Ofreces un jugador de tu plantilla, con o sin dinero.", onClick: () => setMode("trade") })] })] })) : null, mode === "trade" ? (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx(Label, { htmlFor: "offer-player", children: "Jugador que ofreces" }), _jsxs(Select, { value: offeredId, onValueChange: setOfferedId, children: [_jsx(SelectTrigger, { id: "offer-player", className: "min-h-11", children: _jsx(SelectValue, { placeholder: "Selecciona un jugador de tu plantilla" }) }), _jsx(SelectContent, { children: squad.map((candidate) => (_jsxs(SelectItem, { value: candidate.playerId, children: [candidate.name, " \u00B7 ", candidate.position, " \u00B7 OVR ", candidate.ovr, " \u00B7", " ", formatMoney(candidate.value)] }, candidate.playerId))) })] }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: "Ofrecer un jugador libera una plaza y su valor deja de contar en tu plantilla; el motor comprueba los cupos en ambos clubes antes de aceptar la operaci\u00F3n." })] })) : null, _jsxs("div", { className: "grid gap-2 sm:grid-cols-2", children: [_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx(Label, { htmlFor: "offer-cash", children: isFree ? "Coste de firma (M€)" : "Dinero añadido (M€)" }), _jsxs("div", { className: "relative", children: [_jsx(Coins, { "aria-hidden": "true", className: "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" }), _jsx("input", { id: "offer-cash", type: "number", min: 0, step: 0.5, inputMode: "decimal", value: cashInput, disabled: isFree, "aria-describedby": isFree ? "offer-cash-hint" : undefined, onChange: (event) => setCashInput(event.target.value), className: "num h-11 w-full rounded-lg border bg-card pl-9 pr-3 text-sm font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted" })] }), isFree ? (_jsx("p", { id: "offer-cash-hint", className: "text-[11px] text-muted-foreground", children: "Es el coste de firma del agente libre: el sistema lo calcula a partir de su valoraci\u00F3n. Se descuenta de tu presupuesto al ejecutarse." })) : guidance ? (_jsxs("p", { className: "text-[11px] text-muted-foreground", children: ["Sugerido por valoraci\u00F3n: ", formatMoney(guidance.guidance.suggested), " \u00B7", " ", "l\u00EDmite de puja: ", formatMoney(guidance.guidance.walkAway)] })) : null] }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx(Label, { htmlFor: "offer-message", children: "Mensaje para el Presidente" }), _jsx(Textarea, { id: "offer-message", value: message, onChange: (event) => setMessage(event.target.value), placeholder: "Explica brevemente tu propuesta\u2026", className: "min-h-11", rows: 2 })] })] }), _jsx(Separator, {}), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: "Validaci\u00F3n del motor de reglas" }), !guidance ? (_jsxs("p", { className: "flex items-center gap-2 text-sm text-muted-foreground", children: [_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" }), "Comprobando reglas del torneo\u2026"] })) : (_jsx(RuleCheckList, { checks: guidance.checks, variant: "full" })), tradeNeedsPlayer ? (_jsx("p", { className: "rounded-lg border border-amber-500/35 bg-amber-500/[0.07] p-2.5 text-xs leading-relaxed text-amber-800 dark:text-amber-200", children: "Selecciona el jugador de tu plantilla que formar\u00E1 parte del intercambio." })) : null] }), guidance ? (_jsxs("p", { className: cn("flex items-start gap-2 rounded-lg border p-2.5 text-xs leading-relaxed", guidance.passed
                        ? "border-emerald-500/35 bg-emerald-500/[0.07] text-emerald-800 dark:text-emerald-200"
                        : "border-rose-500/35 bg-rose-500/[0.07] text-rose-700 dark:text-rose-300"), children: [_jsx(Sparkles, { className: "mt-0.5 size-3.5 shrink-0", "aria-hidden": "true" }), _jsx("span", { children: guidance.passed
                                ? isFree
                                    ? "La operación cumple el reglamento: si el mercado está abierto se ejecuta de inmediato; si no, queda reservada."
                                    : `Oferta lista para enviar a ${guidance.sellerClubName ?? "el club"}. El acuerdo se reserva y se valida otra vez antes de ejecutarse.`
                                : guidance.blockers[0] })] })) : null, _jsxs("div", { className: "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", children: [_jsx(Button, { type: "button", variant: "outline", className: "min-h-11", onClick: () => onOpenChange(false), children: "Cancelar" }), _jsx(Button, { type: "button", className: "min-h-11", disabled: !canSubmit, onClick: handleSubmit, children: busyKey === "crear" ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" }), "Registrando\u2026"] })) : (_jsxs(_Fragment, { children: [_jsx(Send, { className: "size-4", "aria-hidden": "true" }), isFree ? "Confirmar fichaje" : "Enviar oferta"] })) })] })] }) }));
}
function Money({ label, value }) {
    return (_jsxs("div", { className: "rounded-lg border p-2.5", children: [_jsx("dt", { className: "text-[10px] font-bold uppercase tracking-wide text-muted-foreground", children: label }), _jsx("dd", { className: "num mt-0.5 text-sm font-bold", children: value })] }));
}
function ModeButton({ active, icon: Icon, title, description, onClick, }) {
    return (_jsxs("button", { type: "button", role: "radio", "aria-checked": active, onClick: onClick, className: cn("flex min-h-11 items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors", active
            ? "border-primary bg-primary/5 ring-1 ring-primary/40"
            : "border-border bg-card hover:bg-accent"), children: [_jsx(Icon, { "aria-hidden": "true", className: "mt-0.5 size-4 shrink-0 text-primary" }), _jsxs("span", { className: "flex flex-col", children: [_jsx("span", { className: "text-sm font-semibold", children: title }), _jsx("span", { className: "text-[11px] leading-snug text-muted-foreground", children: description })] })] }));
}
