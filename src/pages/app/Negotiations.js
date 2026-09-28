import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { formatMoney } from "@/convex/rulesEngine";
import { useQuery } from "convex/react";
import { useOutletContext } from "react-router";
import { SectionCard, StatTile } from "@/components/eleven/SectionCard";
import { OfferCard } from "@/components/eleven/OfferCard";
import { BadgeEuro, Handshake, Inbox, Loader2, Send, ShieldCheck, Timer, } from "lucide-react";
import { cn } from "@/lib/utils";
const TABS = [
    { id: "recibidas", label: "Recibidas", icon: Inbox },
    { id: "enviadas", label: "Enviadas", icon: Send },
    { id: "reservadas", label: "Reservadas", icon: Timer },
    { id: "historial", label: "Historial", icon: ShieldCheck },
];
export default function Negotiations() {
    const state = useOutletContext();
    const [tab, setTab] = useState("recibidas");
    const overview = useQuery(api.market.overview);
    const offers = overview === undefined || overview === null
        ? []
        : tab === "recibidas"
            ? overview.received
            : tab === "enviadas"
                ? overview.sent
                : tab === "reservadas"
                    ? overview.reserved
                    : overview.history;
    const counts = {
        recibidas: overview?.received.length ?? 0,
        enviadas: overview?.sent.length ?? 0,
        reservadas: overview?.reserved.length ?? 0,
        historial: overview?.history.length ?? 0,
    };
    return (_jsxs("div", { className: "mx-auto flex w-full max-w-[1500px] flex-col gap-5", children: [_jsxs("header", { className: "flex flex-col gap-2", children: [_jsx("h1", { className: "display text-2xl", children: "Negociaciones" }), _jsx("p", { className: "max-w-3xl text-sm text-muted-foreground", children: "Un acuerdo aceptado no se aplica de inmediato: queda reservado y los jugadores implicados se comprometen hasta la validaci\u00F3n final, de modo que nadie pueda vender al mismo jugador dos veces." })] }), _jsxs("section", { "aria-label": "Resumen de negociaciones", className: "grid gap-3 grid-cols-2 md:grid-cols-4", children: [_jsx(StatTile, { icon: Inbox, tone: counts.recibidas > 0 ? "gold" : "slate", value: String(counts.recibidas), label: "Esperan tu respuesta", hint: counts.recibidas > 0 ? "Alguien quiere negociar" : "Nada pendiente" }), _jsx(StatTile, { icon: Send, tone: "brand", value: String(counts.enviadas), label: "Enviadas por ti", hint: "Pendientes de respuesta" }), _jsx(StatTile, { icon: Timer, tone: "brand", value: String(counts.reservadas), label: "Acuerdos reservados", hint: "Se ejecutan con la validaci\u00F3n final" }), _jsx(StatTile, { icon: BadgeEuro, tone: "slate", value: formatMoney(state.market.committedCash), label: "Presupuesto comprometido", hint: `Disponible ${formatMoney(state.budget.available)}` })] }), _jsx("div", { role: "tablist", "aria-label": "Estado de las negociaciones", className: "flex flex-wrap gap-1.5", children: TABS.map((option) => (_jsxs("button", { type: "button", role: "tab", "aria-selected": tab === option.id, onClick: () => setTab(option.id), className: cn("inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors", tab === option.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-accent"), children: [_jsx(option.icon, { className: "size-4", "aria-hidden": "true" }), option.label, _jsx("span", { className: "num rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground", children: counts[option.id] })] }, option.id))) }), _jsx(SectionCard, { title: tab === "historial"
                    ? "Operaciones cerradas"
                    : tab === "reservadas"
                        ? "Acuerdos reservados por el torneo"
                        : `Ofertas ${tab}`, icon: Handshake, action: { label: "Explorar mercado", to: "/dashboard/mercado" }, children: overview === undefined ? (_jsxs("p", { className: "flex items-center gap-2 text-sm text-muted-foreground", children: [_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" }), "Cargando tus negociaciones\u2026"] })) : offers.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground", children: tab === "recibidas"
                        ? "No hay ofertas esperando tu respuesta. Mientras tanto puedes explorar el mercado."
                        : tab === "enviadas"
                            ? "No tienes ofertas pendientes de respuesta."
                            : tab === "reservadas"
                                ? "No tienes acuerdos reservados. Cuando aceptes una operación aparecerá aquí hasta ejecutarse."
                                : "Todavía no se ha cerrado ninguna operación tuya." })) : (_jsx("ul", { className: "grid gap-3 xl:grid-cols-2", children: offers.map((offer) => (_jsx("li", { children: _jsx(OfferCard, { offer: offer }) }, offer.id))) })) })] }));
}
