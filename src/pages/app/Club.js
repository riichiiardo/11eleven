import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { formatMoney } from "@/convex/rulesEngine";
import { useNavigate, useOutletContext } from "react-router";
import { Crest } from "@/components/eleven/Crest";
import { SectionCard, StatTile } from "@/components/eleven/SectionCard";
import { PitchView } from "@/components/eleven/PitchView";
import { GroupMeter, RuleCheckList } from "@/components/eleven/RuleCheckList";
import { AvailabilityBadge, OvrBadge, PlayerAvatar, } from "@/components/eleven/PlayerBits";
import { PlayerDialog } from "@/components/eleven/PlayerDialog";
import { useSquadActions } from "@/hooks/use-squad-actions";
import { Button } from "@/components/ui/button";
import { Activity, BadgeEuro, Baby, ClipboardList, Crown, Shirt, TrendingUp, Users, } from "lucide-react";
export default function Club() {
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
    return (_jsxs("div", { className: "mx-auto flex w-full max-w-[1400px] flex-col gap-5", children: [_jsxs("section", { className: "card-soft flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx(Crest, { name: club.name, shortName: club.shortName, colors: [club.colorPrimary, club.colorSecondary], size: "lg" }), _jsxs("div", { children: [_jsx("h1", { className: "display text-2xl leading-tight", children: club.name }), _jsxs("p", { className: "mt-1 text-sm text-muted-foreground", children: [club.league, " \u00B7 ", club.country, " \u00B7", " ", _jsx("span", { className: "font-semibold text-foreground", children: state.president?.nickname })] })] })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Button, { type: "button", variant: "outline", className: "min-h-11", onClick: () => navigate("/dashboard/club/plantilla"), children: [_jsx(Users, { className: "size-4", "aria-hidden": "true" }), "Plantilla completa"] }), _jsxs(Button, { type: "button", className: "min-h-11", onClick: () => navigate("/dashboard/formacion"), children: [_jsx(Shirt, { className: "size-4", "aria-hidden": "true" }), "Ajustar once"] })] })] }), _jsxs("section", { "aria-label": "Indicadores del club", className: "grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6", children: [_jsx(StatTile, { icon: Users, value: `${stats.size} / ${rules.squadSize}`, label: "Jugadores", hint: "M\u00E1ximo seg\u00FAn reglas" }), _jsx(StatTile, { icon: TrendingUp, tone: "pitch", value: formatMoney(stats.totalValue), label: "Valor de plantilla" }), _jsx(StatTile, { icon: BadgeEuro, tone: "gold", value: formatMoney(state.budget.available), label: "Presupuesto libre" }), _jsx(StatTile, { icon: Crown, value: `${stats.averageOvr}`, label: "OVR medio" }), _jsx(StatTile, { icon: Activity, tone: "slate", value: `${stats.averageAge}`, label: "Edad media" }), _jsx(StatTile, { icon: Baby, tone: "pitch", value: `${stats.under21} / ${rules.maxU21}`, label: "Sub-21" })] }), _jsxs("div", { className: "grid gap-5 xl:grid-cols-3", children: [_jsx(SectionCard, { title: "Formaci\u00F3n actual", icon: Shirt, accent: "pitch", className: "xl:col-span-2", action: { label: "Editar táctica", to: "/dashboard/formacion" }, children: _jsx(PitchView, { formation: state.lineup.formation, lineup: state.lineup, squad: state.squad, onSlotClick: () => navigate("/dashboard/formacion"), caption: "Cada posici\u00F3n muestra el OVR del titular. La 'C' identifica al capit\u00E1n: el jugador con mayor OVR del once." }) }), _jsxs("div", { className: "flex flex-col gap-5", children: [_jsx(SectionCard, { title: "Distribuci\u00F3n por posici\u00F3n", icon: Users, children: _jsx("div", { className: "grid gap-4", children: ["GK", "DEF", "MID", "FWD"].map((group) => (_jsx(GroupMeter, { group: group, count: stats.groupCounts[group], min: limits[group].min, max: limits[group].max }, group))) }) }), _jsx(SectionCard, { title: "Situaci\u00F3n en el mercado", icon: ClipboardList, action: { label: "Gestionar", to: "/dashboard/club/estado" }, children: _jsx("ul", { className: "flex flex-col gap-2.5", children: ["transferible", "negociacion", "neutro", "intransferible"].map((option) => (_jsxs("li", { className: "flex items-center justify-between gap-3", children: [_jsx(AvailabilityBadge, { availability: option }), _jsx("span", { className: "num text-sm font-bold", children: state.availability[option] })] }, option))) }) })] })] }), _jsxs("div", { className: "grid gap-5 xl:grid-cols-3", children: [_jsx(SectionCard, { title: "Chequeo del reglamento", icon: ClipboardList, className: "xl:col-span-2", action: { label: "Ver reglas", to: "/dashboard/reglas" }, children: _jsx(RuleCheckList, { checks: state.evaluation?.checks ?? [], variant: "full" }) }), _jsx(SectionCard, { title: "Jugadores clave", icon: Crown, action: { label: "Plantilla", to: "/dashboard/club/plantilla" }, children: _jsx("ul", { className: "flex flex-col gap-3", children: stats.topPlayers.map((player) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => setSelected(player), className: "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors hover:bg-accent", children: [_jsx(PlayerAvatar, { name: player.name, flag: player.flag, group: player.group, size: "sm", photo: player.photo }), _jsxs("span", { className: "min-w-0 flex-1", children: [_jsx("span", { className: "block truncate text-sm font-semibold", children: player.name }), _jsxs("span", { className: "block truncate text-[11px] text-muted-foreground", children: [player.position, " \u00B7 ", formatMoney(player.value)] })] }), _jsx(OvrBadge, { ovr: player.ovr })] }) }, player.squadPlayerId))) }) })] }), _jsx(PlayerDialog, { player: selected, open: Boolean(selected), onOpenChange: (open) => !open && setSelected(null), saving: savingAvailability, onSaveAvailability: async (playerId, availability) => {
                    if (!selected)
                        return;
                    await saveAvailability(playerId, availability, selected.name);
                } })] }));
}
