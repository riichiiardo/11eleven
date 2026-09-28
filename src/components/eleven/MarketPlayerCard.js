import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatMoney } from "@/convex/rulesEngine";
import { AvailabilityBadge, OvrBadge, PlayerAvatar, PositionPill } from "./PlayerBits";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Market card (prompt §17-20): everything the President needs to decide without
 * opening another screen — who the player is, what he costs, who owns him and
 * whether an offer is even possible. "Not offerable" always carries a written
 * reason, never just a locked icon.
 */
export function MarketPlayerCard({ player, budgetAvailable, onOffer, compact = false, }) {
    const isFree = player.kind === "libre";
    // "libre" is not a squad availability flag: free agents have no President to
    // negotiate with, so the badge is replaced instead of mislabelled.
    const squadAvailability = player.availability === "libre" ? null : player.availability;
    const maxOffer = Math.max(0, budgetAvailable);
    return (_jsxs("article", { className: cn("card-soft flex h-full flex-col gap-3 p-3.5 transition-shadow hover:shadow-md", !player.offerable && "opacity-90"), children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx(PlayerAvatar, { name: player.name, flag: player.flag, group: player.group, size: "md", photo: player.photo }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("h3", { className: "truncate text-[12px] font-bold", children: player.name }), _jsxs("p", { className: "truncate text-[10px] text-muted-foreground", children: [player.nationality, " \u00B7 ", player.age, " a\u00F1os"] }), _jsxs("div", { className: "mt-1 flex flex-wrap items-center gap-1", children: [_jsx(PositionPill, { position: player.position, group: player.group }), _jsx("span", { className: "num rounded-md bg-muted px-1 py-0.5 text-[9px] font-bold text-muted-foreground", children: player.realClub })] })] }), _jsx(OvrBadge, { ovr: player.ovr, className: "!min-w-6 !p-0 !text-[10px]" })] }), _jsxs("div", { className: "flex items-baseline justify-between gap-2", children: [_jsx("span", { className: "num text-base font-bold text-primary", children: formatMoney(player.value) }), _jsx("span", { className: "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground", children: isFree ? "Coste de firma" : "Valoración" })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-1.5", children: [squadAvailability ? (_jsx(AvailabilityBadge, { availability: squadAvailability })) : (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300", children: [_jsx(Sparkles, { className: "size-3", "aria-hidden": "true" }), "AGENTE LIBRE"] })), player.ownerClubName ? (_jsxs("span", { className: "truncate text-[10px] text-muted-foreground", children: [player.ownerClubName, player.ownerNickname ? ` · ${player.ownerNickname}` : ""] })) : null] }), showDetail !== false ? (_jsx("p", { className: cn("rounded-lg border p-2 text-[11px] leading-relaxed", player.offerable
                    ? "border-border bg-muted/40 text-muted-foreground"
                    : "border-amber-500/35 bg-amber-500/[0.07] text-amber-800 dark:text-amber-200"), children: player.offerable
                    ? isFree
                        ? `Presupuesto disponible ${formatMoney(budgetAvailable)} · oferta máxima ${formatMoney(maxOffer)}.`
                        : "Puedes iniciar una negociación con su Presidente desde aquí."
                    : player.blockedReason })) : null, _jsx("div", { className: "mt-auto flex items-center gap-2", children: player.offerable ? (_jsx(Button, { type: "button", className: "min-h-9 flex-1", onClick: () => onOffer(player), children: isFree ? "Fichar" : "Oferta" })) : (_jsxs(Button, { type: "button", variant: "outline", disabled: true, className: "min-h-9 flex-1", title: player.blockedReason ?? undefined, children: [_jsx(Lock, { className: "size-3.5", "aria-hidden": "true" }), player.ownerIsMe ? "Tu jugador" : "No disponible"] })) })] }));
}
