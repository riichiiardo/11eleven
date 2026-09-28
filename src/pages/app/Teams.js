import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { formatMoney, POSITION_LABEL } from "@/convex/rulesEngine";
import { useQuery } from "convex/react";
import { useOutletContext } from "react-router";
import { SectionCard, StatTile } from "@/components/eleven/SectionCard";
import { Crest } from "@/components/eleven/Crest";
import { SquadShapeRow, SquadTable } from "@/components/eleven/SquadTable";
import { OvrBadge } from "@/components/eleven/PlayerBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { ArrowRightLeft, BadgeEuro, Eye, Loader2, ScanSearch, Shield, Users, } from "lucide-react";
import { cn } from "@/lib/utils";
const COMPARE_ROWS = [
    { key: "squadSize", label: "Jugadores", render: (t) => String(t?.stats.size ?? 0), better: null },
    { key: "avgOvr", label: "OVR medio", render: (t) => String(t?.stats.averageOvr ?? 0), better: "high" },
    { key: "xiOvr", label: "OVR del XI", render: (t) => String(t?.xiOvr ?? 0), better: "high" },
    { key: "value", label: "Valor total", render: (t) => formatMoney(t?.stats.totalValue ?? 0), better: "high" },
    { key: "avgAge", label: "Edad media", render: (t) => String(t?.stats.averageAge ?? 0), better: "low" },
    { key: "u21", label: "Sub-21", render: (t) => String(t?.stats.under21 ?? 0), better: null },
];
function XiChips({ team }) {
    if (team.xi.length === 0) {
        return (_jsx("p", { className: "text-xs text-muted-foreground", children: "Este club todav\u00EDa no ha definido su alineaci\u00F3n." }));
    }
    return (_jsx("div", { className: "flex flex-wrap gap-1.5", children: team.xi.map((slot) => (_jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-lg border bg-muted/40 px-2 py-1 text-xs", children: [_jsx(OvrBadge, { ovr: slot.ovr }), _jsx("span", { className: "max-w-[10rem] truncate font-semibold", children: slot.name }), _jsx("span", { className: "text-[10px] text-muted-foreground", children: POSITION_LABEL[slot.position] })] }, slot.slotId))) }));
}
function TeamSummary({ team, mine = false, }) {
    if (!team) {
        return (_jsx("p", { className: "py-6 text-sm text-muted-foreground", children: mine
                ? "Aún no presides ningún club."
                : "Este club todavía no tiene plantilla registrada." }));
    }
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-2 sm:grid-cols-4", children: [_jsx(StatTile, { icon: Users, label: "Jugadores", value: String(team.stats.size) }), _jsx(StatTile, { icon: ScanSearch, label: "OVR medio", value: String(team.stats.averageOvr) }), _jsx(StatTile, { icon: Shield, label: "OVR del XI", value: String(team.xiOvr) }), _jsx(StatTile, { icon: BadgeEuro, label: "Valor total", value: formatMoney(team.stats.totalValue) })] }), _jsx(XiChips, { team: team })] }));
}
function TeamSquadDialog({ club, team, onClose, rules, }) {
    const limit = {
        GK: { min: rules.gkMin, max: rules.gkMax },
        DEF: { min: rules.defMin, max: rules.defMax },
        MID: { min: rules.midMin, max: rules.midMax },
        FWD: { min: rules.fwdMin, max: rules.fwdMax },
    };
    return (_jsx(Dialog, { open: Boolean(club), onOpenChange: (open) => !open && onClose(), children: _jsxs(DialogContent, { className: "flex max-h-[92vh] flex-col overflow-hidden sm:max-w-2xl", children: [club ? (_jsxs(DialogHeader, { children: [_jsxs(DialogTitle, { className: "flex items-center gap-2.5 text-base", children: [_jsx(Crest, { name: club.name, shortName: club.shortName, colors: [club.colorPrimary, club.colorSecondary], size: "sm" }), _jsx("span", { className: "display", children: club.name })] }), _jsx(DialogDescription, { children: club.presidentNickname
                                ? `Presidente ${club.presidentNickname} · ${club.league}`
                                : `Club libre · ${club.league}` })] })) : null, team ? (_jsx("div", { className: "scroll-thin -mx-1 min-h-0 flex-1 overflow-y-auto px-1", children: _jsxs("div", { className: "flex flex-col gap-4 pb-2", children: [_jsxs("div", { className: "grid grid-cols-3 gap-2", children: [_jsx(StatTile, { icon: Users, label: "Jugadores", value: String(team.stats.size) }), _jsx(StatTile, { icon: ScanSearch, label: "OVR medio", value: String(team.stats.averageOvr) }), _jsx(StatTile, { icon: Shield, label: "OVR del XI", value: String(team.xiOvr) })] }), _jsxs("div", { children: [_jsxs("p", { className: "mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground", children: ["Once inicial (", team.formation, ")"] }), _jsx(XiChips, { team: team })] }), _jsxs("div", { children: [_jsx("p", { className: "mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground", children: "Forma de la plantilla" }), _jsx(SquadShapeRow, { stats: team.stats, limits: limit })] }), _jsx(SquadTable, { squad: team.squad, stats: team.stats })] }) })) : (_jsx("div", { className: "flex items-center justify-center py-10", children: _jsx(Loader2, { className: "size-5 animate-spin text-muted-foreground" }) }))] }) }));
}
function CompareTable({ mine, rival, }) {
    return (_jsxs(SectionCard, { title: "Comparativa", icon: ArrowRightLeft, accent: "gold", className: "lg:col-span-2", children: [_jsx("div", { className: "overflow-x-auto scroll-thin", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { className: "bg-muted/50 hover:bg-muted/50", children: [_jsx(TableHead, { children: "M\u00E9trica" }), _jsx(TableHead, { className: "text-center", children: _jsxs("span", { className: "flex items-center justify-center gap-1.5", children: [_jsx(Crest, { name: mine.clubName, shortName: mine.clubShortName, colors: mine.clubColors, size: "sm" }), _jsx("span", { className: "max-w-[9rem] truncate", children: mine.clubName })] }) }), _jsx(TableHead, { className: "text-center", children: _jsxs("span", { className: "flex items-center justify-center gap-1.5", children: [_jsx(Crest, { name: rival.clubName, shortName: rival.clubShortName, colors: rival.clubColors, size: "sm" }), _jsx("span", { className: "max-w-[9rem] truncate", children: rival.clubName })] }) })] }) }), _jsx(TableBody, { children: COMPARE_ROWS.map((row) => {
                                const mineValue = row.render(mine);
                                const rivalValue = row.render(rival);
                                const mineNum = Number(mineValue.replace(/[^\d.-]/g, ""));
                                const rivalNum = Number(rivalValue.replace(/[^\d.-]/g, ""));
                                const mineWins = row.better === null ||
                                    Number.isNaN(mineNum) ||
                                    Number.isNaN(rivalNum)
                                    ? null
                                    : row.better === "high"
                                        ? mineNum > rivalNum
                                        : mineNum < rivalNum;
                                return (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: row.label }), _jsx(TableCell, { className: cn("num text-center text-sm font-semibold", mineWins === true && "text-emerald-600 dark:text-emerald-400"), children: mineValue }), _jsx(TableCell, { className: cn("num text-center text-sm font-semibold", mineWins === false && "text-emerald-600 dark:text-emerald-400"), children: rivalValue })] }, row.key));
                            }) })] }) }), _jsx("p", { className: "mt-2 text-[11px] text-muted-foreground", children: "En verde se resalta el mejor valor de cada m\u00E9trica." })] }));
}
/**
 * Equipos (prompt IA: EQUIPOS → Todos los equipos / Plantillas / Comparar
 * equipos): club directory, public squad inspection and side-by-side
 * comparison against my own club.
 */
export default function Teams() {
    const state = useOutletContext();
    const tournament = state.tournament;
    const myClub = state.club;
    const rules = state.rules;
    const [queryText, setQueryText] = useState("");
    const [mode, setMode] = useState("todos");
    const [compareId, setCompareId] = useState(null);
    const [detailId, setDetailId] = useState(null);
    const compareClub = useMemo(() => state.clubs.find((club) => club.id === compareId) ?? null, [state.clubs, compareId]);
    const detailClub = useMemo(() => state.clubs.find((club) => club.id === detailId) ?? null, [state.clubs, detailId]);
    const mySquadQuery = useQuery(api.teams.squadOf, myClub ? { clubId: myClub.id } : "skip");
    const compareSquadQuery = useQuery(api.teams.squadOf, compareClub && compareClub.id !== myClub?.id ? { clubId: compareClub.id } : "skip");
    const detailSquadQuery = useQuery(api.teams.squadOf, detailClub ? { clubId: detailClub.id } : "skip");
    const clubs = useMemo(() => {
        const text = queryText.trim().toLowerCase();
        const sorted = [...state.clubs].sort((a, b) => {
            if (myClub && a.id === myClub.id)
                return -1;
            if (myClub && b.id === myClub.id)
                return 1;
            return a.name.localeCompare(b.name);
        });
        if (!text)
            return sorted;
        return sorted.filter((club) => club.name.toLowerCase().includes(text) ||
            club.shortName.toLowerCase().includes(text) ||
            (club.presidentNickname ?? "").toLowerCase().includes(text));
    }, [state.clubs, queryText, myClub]);
    if (!tournament || !rules) {
        return (_jsx(SectionCard, { title: "Equipos", children: _jsx("p", { className: "text-sm text-muted-foreground", children: "El torneo todav\u00EDa no est\u00E1 disponible. Vuelve al inicio." }) }));
    }
    const showCompare = mode === "comparar" && Boolean(compareClub) && Boolean(myClub);
    return (_jsxs("div", { className: "flex flex-col gap-5", children: [_jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "display text-xl tracking-tight", children: "Equipos" }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [state.clubs.length, " clubes \u00B7 ", tournament.name, " \u00B7 ", tournament.season] })] }), _jsxs("div", { className: "flex w-full items-center gap-2 sm:w-auto", children: [_jsx(Input, { value: queryText, onChange: (event) => setQueryText(event.target.value), placeholder: "Buscar club o presidente\u2026", className: "h-10 flex-1 sm:w-60" }), _jsx(Tabs, { value: mode, onValueChange: (value) => setMode(value), children: _jsxs(TabsList, { children: [_jsx(TabsTrigger, { value: "todos", className: "cursor-pointer", children: "Todos" }), _jsx(TabsTrigger, { value: "comparar", disabled: !myClub, className: "cursor-pointer", children: "Comparar" })] }) })] })] }), showCompare ? (_jsxs("div", { className: "grid gap-4 lg:grid-cols-2", children: [_jsx(SectionCard, { title: "Mi club", icon: Shield, accent: "brand", children: mySquadQuery === undefined ? (_jsx("div", { className: "flex items-center justify-center py-10", children: _jsx(Loader2, { className: "size-5 animate-spin text-muted-foreground" }) })) : (_jsx(TeamSummary, { team: mySquadQuery ?? null, mine: true })) }), _jsx(SectionCard, { title: compareClub?.name ?? "Rival", icon: ArrowRightLeft, accent: "pitch", action: compareClub ? { label: "Cambiar", to: "#equipos" } : undefined, children: compareSquadQuery === undefined ? (_jsx("div", { className: "flex items-center justify-center py-10", children: _jsx(Loader2, { className: "size-5 animate-spin text-muted-foreground" }) })) : (_jsx(TeamSummary, { team: compareSquadQuery ?? null })) }), mySquadQuery && compareSquadQuery ? (_jsx(CompareTable, { mine: mySquadQuery, rival: compareSquadQuery })) : null] })) : (_jsxs(SectionCard, { title: "Todos los equipos", icon: Users, children: [mode === "comparar" && !compareClub ? (_jsx("p", { className: "mb-3 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground", children: "Elige un club de la lista con el bot\u00F3n \u00ABComparar\u00BB para medirlo contra tu plantilla." })) : null, _jsxs("div", { className: "flex flex-col divide-y", children: [clubs.map((club) => (_jsxs("div", { className: "flex items-center gap-3 py-3", children: [_jsx(Crest, { name: club.name, shortName: club.shortName, colors: [club.colorPrimary, club.colorSecondary], size: "md" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("p", { className: "flex items-center gap-2 truncate text-sm font-bold", children: [club.name, myClub && club.id === myClub.id ? (_jsx("span", { className: "rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary", children: "Mi club" })) : null, !club.presidentNickname ? (_jsx("span", { className: "rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300", children: "Libre" })) : null] }), _jsxs("p", { className: "truncate text-[11px] text-muted-foreground", children: [club.presidentNickname
                                                        ? `${club.presidentNickname} · ${club.league}`
                                                        : club.league, " · ", club.rosterSize, " jugadores \u00B7 OVR ", club.averageOvr] })] }), _jsxs("div", { className: "flex shrink-0 items-center gap-1.5", children: [_jsxs(Button, { variant: "outline", size: "sm", className: "min-h-9", onClick: () => setDetailId(club.id), children: [_jsx(Eye, { className: "size-3.5", "aria-hidden": "true" }), _jsx("span", { className: "hidden sm:inline", children: "Plantilla" })] }), myClub && club.id !== myClub.id ? (_jsxs(Button, { variant: "outline", size: "sm", className: "min-h-9", onClick: () => {
                                                    setCompareId(club.id);
                                                    setMode("comparar");
                                                }, children: [_jsx(ArrowRightLeft, { className: "size-3.5", "aria-hidden": "true" }), _jsx("span", { className: "hidden sm:inline", children: "Comparar" })] })) : null] })] }, club.id))), clubs.length === 0 ? (_jsx("p", { className: "py-6 text-center text-sm text-muted-foreground", children: "Ning\u00FAn club coincide con la b\u00FAsqueda." })) : null] })] })), _jsx(TeamSquadDialog, { club: detailClub, team: detailClub ? (detailSquadQuery ?? null) : null, onClose: () => setDetailId(null), rules: rules })] }));
}
