import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { MARKET_SCOPE_LABEL } from "@/convex/marketEngine";
import { formatMoney } from "@/convex/rulesEngine";
import { useQuery } from "convex/react";
import { useOutletContext } from "react-router";
import { SectionCard, StatTile } from "@/components/eleven/SectionCard";
import { OfferDialog } from "@/components/eleven/OfferDialog";
import { MarketPlayerCard } from "@/components/eleven/MarketPlayerCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { BadgeEuro, Handshake, Loader2, Lock, Search, ShoppingBag, Sparkles, Users, } from "lucide-react";
import { cn } from "@/lib/utils";
const SCOPES = ["todos", "libre", "clubes"];
const SORTS = [
    { value: "ovr", label: "Mejor OVR" },
    { value: "value", label: "Más valiosos" },
    { value: "age", label: "Más jóvenes" },
    { value: "name", label: "Nombre (A-Z)" },
];
const GROUPS = [
    { value: "todos", label: "Todas las posiciones" },
    { value: "GK", label: "Porteros" },
    { value: "DEF", label: "Defensas" },
    { value: "MID", label: "Medios" },
    { value: "FWD", label: "Ataque" },
];
export default function Market() {
    const state = useOutletContext();
    const [scope, setScope] = useState("todos");
    const [search, setSearch] = useState("");
    const [group, setGroup] = useState("todos");
    const [sort, setSort] = useState("ovr");
    const [onlyAffordable, setOnlyAffordable] = useState(false);
    const [selected, setSelected] = useState(null);
    const marketOpen = state.tournament?.marketOpen ?? false;
    // browse returns { players, total, nationalities }; the list body consumes the
    // players array while total is still the server-side facet for the count.
    const browseView = useQuery(api.market.browse, {
        scope,
        search: search.trim() || undefined,
        group: group,
        sort: sort,
        onlyAffordable,
        limit: 60,
    });
    const players = browseView ? (browseView.players ?? []) : [];
    const summary = state.market;
    const freeAgents = useMemo(() => players.filter((player) => player.kind === "libre").length, [players]);
    const canTrade = countSellable(state);
    return (_jsxs("div", { className: "mx-auto flex w-full max-w-[1500px] flex-col gap-5", children: [_jsxs("header", { className: "flex flex-col gap-2", children: [_jsx("h1", { className: "display text-2xl", children: "Mercado de jugadores" }), _jsx("p", { className: "max-w-3xl text-sm text-muted-foreground", children: "Ficha agentes libres con presupuesto o negocia con otros Presidentes. Cada oferta se comprueba con el mismo reglamento que gobierna tu plantilla, as\u00ED que sabr\u00E1s por qu\u00E9 una operaci\u00F3n no es posible antes de enviarla." })] }), _jsxs("section", { "aria-label": "Resumen del mercado", className: "grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5", children: [_jsx(StatTile, { icon: marketOpen ? Sparkles : Lock, tone: marketOpen ? "pitch" : "slate", value: marketOpen ? "Abierto" : "Cerrado", label: "Ventana de mercado", hint: marketOpen ? "Las operaciones se ejecutan" : "Solo se reservan acuerdos" }), _jsx(StatTile, { icon: BadgeEuro, tone: "gold", value: formatMoney(state.budget.available), label: "Presupuesto disponible", hint: `Inicial ${formatMoney(state.budget.initial)}` }), _jsx(StatTile, { icon: ShoppingBag, tone: "brand", value: String(summary.freeAgents), label: "Agentes libres", hint: `${freeAgents} en la vista actual` }), _jsx(StatTile, { icon: Handshake, tone: "brand", value: String(summary.received + summary.sent), label: "Negociaciones abiertas", hint: `${summary.received} recibidas · ${summary.sent} enviadas` }), _jsx(StatTile, { icon: Users, tone: "slate", value: String(canTrade), label: "Jugadores que puedes ofrecer", hint: "Sin romper cupos ni m\u00EDnimos" })] }), _jsxs(SectionCard, { title: "Explorar jugadores", icon: Search, action: { label: "Mis negociaciones", to: "/dashboard/mercado/negociaciones" }, children: [_jsx("div", { role: "tablist", "aria-label": "Origen de los jugadores", className: "flex flex-wrap gap-1.5", children: SCOPES.map((option) => (_jsx("button", { type: "button", role: "tab", "aria-selected": scope === option, onClick: () => setScope(option), className: cn("min-h-11 rounded-lg border px-3 text-sm font-semibold transition-colors", scope === option
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-card text-muted-foreground hover:bg-accent"), children: MARKET_SCOPE_LABEL[option] }, option))) }), _jsxs("div", { className: "mt-4 grid gap-3 lg:grid-cols-[1.6fr_1fr_1fr_auto] lg:items-end", children: [_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx(Label, { htmlFor: "market-search", children: "Buscar" }), _jsxs("div", { className: "relative", children: [_jsx(Search, { "aria-hidden": "true", className: "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" }), _jsx("input", { id: "market-search", type: "search", value: search, onChange: (event) => setSearch(event.target.value), placeholder: "Jugador, nacionalidad, posici\u00F3n o club\u2026", className: "h-11 w-full rounded-lg border bg-card pl-9 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" })] })] }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx(Label, { htmlFor: "market-group", children: "Posici\u00F3n" }), _jsxs(Select, { value: group, onValueChange: setGroup, children: [_jsx(SelectTrigger, { id: "market-group", className: "min-h-11", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: GROUPS.map((option) => (_jsx(SelectItem, { value: option.value, children: option.label }, option.value))) })] })] }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx(Label, { htmlFor: "market-sort", children: "Ordenar por" }), _jsxs(Select, { value: sort, onValueChange: setSort, children: [_jsx(SelectTrigger, { id: "market-sort", className: "min-h-11", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: SORTS.map((option) => (_jsx(SelectItem, { value: option.value, children: option.label }, option.value))) })] })] }), _jsxs("div", { className: "flex min-h-11 items-center gap-2.5", children: [_jsx(Switch, { id: "market-affordable", checked: onlyAffordable, onCheckedChange: setOnlyAffordable }), _jsx(Label, { htmlFor: "market-affordable", className: "text-sm", children: "Solo lo que puedo fichar" })] })] })] }), _jsxs("section", { "aria-label": "Resultados del mercado", className: "flex flex-col gap-3", children: [_jsxs("div", { className: "flex flex-wrap items-baseline justify-between gap-2", children: [_jsxs("h2", { className: "display flex items-center gap-2 text-sm", children: [_jsx("span", { "aria-hidden": "true", className: "h-4 w-1 rounded-full bg-brand" }), players === undefined
                                        ? "Cargando jugadores…"
                                        : `${players.length} jugador(es) en ${MARKET_SCOPE_LABEL[scope].toLowerCase()}`] }), players !== undefined && players.length > 0 ? (_jsxs("p", { className: "text-[11px] text-muted-foreground", children: ["Presupuesto reservado: ", formatMoney(summary.committedCash)] })) : null] }), players === undefined ? (_jsxs("div", { className: "card-soft flex items-center gap-3 p-6 text-sm text-muted-foreground", children: [_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" }), "Consultando el cat\u00E1logo del torneo\u2026"] })) : players.length === 0 ? (_jsx(EmptyMarket, { onReset: () => {
                            setSearch("");
                            setGroup("todos");
                            setOnlyAffordable(false);
                            setScope("todos");
                        } })) : (_jsx("ul", { className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-3", children: players.map((player) => (_jsx("li", { children: _jsx(MarketPlayerCard, { player: player, budgetAvailable: state.budget.available, onOffer: (target) => setSelected(target), showDetail: true }) }, player.playerId))) }))] }), selected ? (_jsx(OfferDialog, { player: selected, squad: state.squad, budget: state.budget, open: true, onOpenChange: (open) => {
                    if (!open)
                        setSelected(null);
                } }, selected.playerId)) : null, marketOpen ? null : (_jsx("p", { className: "rounded-lg border border-amber-500/35 bg-amber-500/[0.07] p-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200", children: "La ventana de mercado est\u00E1 cerrada: puedes negociar y dejar acuerdos reservados, pero se aplicar\u00E1n a las plantillas cuando Administraci\u00F3n abra la ventana y superen la validaci\u00F3n final." }))] }));
}
/** Players the President can actually put in a deal without breaking a cupo. */
function countSellable(state) {
    const rules = state.rules;
    if (!rules)
        return 0;
    const limits = {
        GK: { min: rules.gkMin },
        DEF: { min: rules.defMin },
        MID: { min: rules.midMin },
        FWD: { min: rules.fwdMin },
    };
    const counts = state.stats?.groupCounts ?? { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    return (state.squad ?? []).filter((player) => counts[player.group] - 1 >= limits[player.group].min).length;
}
function EmptyMarket({ onReset }) {
    return (_jsxs("div", { className: "card-soft flex flex-col items-start gap-3 p-6", children: [_jsx("p", { className: "text-sm font-semibold", children: "No hay jugadores que cumplan estos filtros." }), _jsx("p", { className: "max-w-xl text-xs leading-relaxed text-muted-foreground", children: "El mercado interno del torneo solo muestra jugadores de la base versionada y presidencias activas. Prueba a ampliar el origen, quitar el filtro de presupuesto o buscar por otro nombre." }), _jsx(Button, { type: "button", variant: "outline", className: "min-h-11", onClick: onReset, children: "Quitar filtros" })] }));
}
