import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { FC_VERSION, formatMoney } from "@/convex/rulesEngine";
import { useNavigate, useOutletContext } from "react-router";
import { SectionCard } from "@/components/eleven/SectionCard";
import { PitchView } from "@/components/eleven/PitchView";
import { SquadTable } from "@/components/eleven/SquadTable";
import { GroupMeter } from "@/components/eleven/RuleCheckList";
import { AvailabilityBadge, OvrBadge, PlayerAvatar, PositionPill, } from "@/components/eleven/PlayerBits";
import { PlayerDialog } from "@/components/eleven/PlayerDialog";
import { useSquadActions } from "@/hooks/use-squad-actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ClipboardList, Info, LayoutGrid, Shirt, Sparkles } from "lucide-react";
export default function Squad() {
    const state = useOutletContext();
    const navigate = useNavigate();
    const { saveAvailability, savingAvailability } = useSquadActions();
    const [selected, setSelected] = useState(null);
    const club = state.club;
    const rules = state.rules;
    const stats = state.stats;
    if (!club || !rules || !stats || !state.lineup)
        return null;
    const limits = {
        GK: { min: rules.gkMin, max: rules.gkMax },
        DEF: { min: rules.defMin, max: rules.defMax },
        MID: { min: rules.midMin, max: rules.midMax },
        FWD: { min: rules.fwdMin, max: rules.fwdMax },
    };
    const starters = state.lineupEvaluation?.starters ?? [];
    const bench = state.lineupEvaluation?.bench ?? [];
    const startersValue = starters.reduce((sum, player) => sum + player.value, 0);
    const goToFormation = (player) => navigate("/dashboard/formacion", { state: { playerId: player.playerId } });
    return (_jsxs("div", { className: "mx-auto flex w-full max-w-[1400px] flex-col gap-5", children: [_jsxs("header", { className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "display text-2xl", children: "Plantilla" }), _jsxs("p", { className: "mt-1 text-sm text-muted-foreground", children: [stats.size, " jugadores \u00B7 ", formatMoney(stats.totalValue), " \u00B7 OVR medio", " ", stats.averageOvr, " \u00B7 edad media ", stats.averageAge] }), _jsxs("p", { className: "mt-1 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground", children: [_jsx(Sparkles, { className: "size-3.5", "aria-hidden": "true" }), "Datos de origen: ", FC_VERSION] })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Button, { type: "button", variant: "outline", className: "min-h-11", onClick: () => navigate("/dashboard/formacion"), children: [_jsx(Shirt, { className: "size-4", "aria-hidden": "true" }), "Formaci\u00F3n y t\u00E1ctica"] }), _jsxs(Button, { type: "button", variant: "outline", className: "min-h-11", onClick: () => navigate("/dashboard/club/estado"), children: [_jsx(ClipboardList, { className: "size-4", "aria-hidden": "true" }), "Estado de jugadores"] })] })] }), _jsx("div", { className: "grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4", children: ["GK", "DEF", "MID", "FWD"].map((group) => (_jsx(GroupMeter, { group: group, count: stats.groupCounts[group], min: limits[group].min, max: limits[group].max }, group))) }), _jsxs(Tabs, { defaultValue: "campo", className: "flex flex-col gap-4", children: [_jsxs(TabsList, { className: "self-start", children: [_jsxs(TabsTrigger, { value: "campo", className: "min-h-10", children: [_jsx(LayoutGrid, { className: "size-4", "aria-hidden": "true" }), "Vista campo"] }), _jsxs(TabsTrigger, { value: "lista", className: "min-h-10", children: [_jsx(ClipboardList, { className: "size-4", "aria-hidden": "true" }), "Lista completa"] })] }), _jsx(TabsContent, { value: "campo", className: "flex flex-col gap-5", children: _jsxs("div", { className: "grid gap-5 xl:grid-cols-3", children: [_jsxs(SectionCard, { title: "Once titular", icon: Shirt, accent: "pitch", className: "xl:col-span-2", children: [_jsx(PitchView, { formation: state.lineup.formation, lineup: state.lineup, squad: state.squad, onSlotClick: () => navigate("/dashboard/formacion") }), _jsxs("dl", { className: "mt-4 grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-3 text-sm", children: [_jsxs("div", { children: [_jsx("dt", { className: "text-[10px] font-bold uppercase tracking-wide text-muted-foreground", children: "Valor del XI" }), _jsx("dd", { className: "num font-bold", children: formatMoney(startersValue) })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-[10px] font-bold uppercase tracking-wide text-muted-foreground", children: "Titulares" }), _jsxs("dd", { className: "num font-bold", children: [starters.length, " / 11"] })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-[10px] font-bold uppercase tracking-wide text-muted-foreground", children: "Banquillo" }), _jsx("dd", { className: "num font-bold", children: bench.length })] })] })] }), _jsx(SectionCard, { title: "Banquillo", icon: ClipboardList, children: _jsxs("ul", { className: "flex flex-col gap-2", children: [bench.map((player) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => setSelected(player), className: "flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors hover:bg-accent", children: [_jsx(PlayerAvatar, { name: player.name, flag: player.flag, group: player.group, size: "xs", photo: player.photo }), _jsxs("span", { className: "min-w-0 flex-1", children: [_jsx("span", { className: "block truncate text-sm font-semibold", children: player.name }), _jsxs("span", { className: "block truncate text-[11px] text-muted-foreground", children: [player.position, " \u00B7 ", formatMoney(player.value)] })] }), _jsx(OvrBadge, { ovr: player.ovr })] }) }, player.squadPlayerId))), bench.length === 0 ? (_jsx("li", { className: "text-sm text-muted-foreground", children: "Todos tus jugadores est\u00E1n en el once." })) : null] }) })] }) }), _jsxs(TabsContent, { value: "lista", className: "flex flex-col gap-5", children: [_jsx(SquadTable, { squad: state.squad, stats: stats, onSelect: setSelected }), _jsxs("p", { className: "flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground", children: [_jsx(Info, { className: "mt-0.5 size-3.5 shrink-0", "aria-hidden": "true" }), "La tabla muestra la situaci\u00F3n de cada jugador en el mercado. Para cambiar el once titular usa la vista de formaci\u00F3n: el motor de reglas valida cada posici\u00F3n antes de guardar."] })] })] }), _jsx(SectionCard, { title: "Todos los jugadores por situaci\u00F3n", icon: ClipboardList, children: _jsx("ul", { className: "flex flex-wrap gap-2", children: state.squad.map((player) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => setSelected(player), className: "flex min-h-11 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:bg-accent", children: [_jsx(PlayerAvatar, { name: player.name, flag: player.flag, group: player.group, size: "xs", photo: player.photo }), _jsx("span", { className: "text-sm font-semibold", children: player.name.split(" ").slice(-1) }), _jsx(PositionPill, { position: player.position, group: player.group }), _jsx(AvailabilityBadge, { availability: player.availability, showLabel: false })] }) }, player.squadPlayerId))) }) }), _jsx(PlayerDialog, { player: selected, open: Boolean(selected), onOpenChange: (open) => !open && setSelected(null), saving: savingAvailability, assignLabel: "Alinear en el XI", onAssign: goToFormation, onSaveAvailability: async (playerId, availability) => {
                    if (!selected)
                        return;
                    await saveAvailability(playerId, availability, selected.name);
                } })] }));
}
