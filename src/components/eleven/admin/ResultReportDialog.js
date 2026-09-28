import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/lib/errors";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { Loader2, Plus, Save, Stethoscope, X } from "lucide-react";
import { cn } from "@/lib/utils";
/** Cards are one row each; this groups them per player with a count. */
function grouped(rows) {
    const map = new Map();
    for (const row of rows) {
        const current = map.get(row.playerId);
        if (current)
            current.count += 1;
        else
            map.set(row.playerId, { playerId: row.playerId, name: row.name, count: 1 });
    }
    return [...map.values()];
}
/**
 * "Modo árbitro" for a single match: the Administrator/Co-Administrator enters
 * the final score, the goals per player, yellow/red cards per player and the
 * injured players with how many matchdays they will be out.
 */
export function ResultReportButton({ fixture }) {
    const [open, setOpen] = useState(false);
    return (_jsxs(_Fragment, { children: [_jsxs(Button, { type: "button", variant: "outline", size: "sm", className: "min-h-9 shrink-0", onClick: () => setOpen(true), children: [_jsx(Save, { className: "size-3.5", "aria-hidden": "true" }), fixture.status === "jugado" ? "Corregir resultado" : "Registrar resultado"] }), open ? _jsx(ResultReportDialog, { fixture: fixture, open: true, onOpenChange: setOpen }) : null] }));
}
function ResultReportDialog({ fixture, open, onOpenChange, }) {
    const data = useQuery(api.adminOps.fixtureReport, { fixtureId: fixture.id });
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-h-[90vh] overflow-y-auto sm:max-w-3xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { className: "display", children: "Resultado detallado del partido" }), _jsxs(DialogDescription, { children: ["Jornada ", fixture.matchday, " \u00B7 ", fixture.home.name, " vs ", fixture.away.name, ". Marca el marcador y desglosa goles, tarjetas y lesiones por jugador."] })] }), data === undefined ? (_jsxs("div", { className: "flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground", children: [_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" }), "Cargando las plantillas del partido\u2026"] })) : data === null ? (_jsx("p", { className: "rounded-lg border border-amber-500/35 bg-amber-500/[0.07] p-3 text-xs text-amber-800 dark:text-amber-200", children: "Este partido ya no existe en la liga." })) : (_jsx(ReportForm, { fixture: fixture, data: data, onDone: () => onOpenChange(false) }))] }) }));
}
function ReportForm({ fixture, data, onDone, }) {
    const submit = useMutation(api.adminOps.reportFixture);
    const existing = data.report;
    const [homeGoals, setHomeGoals] = useState(existing?.homeGoals ?? 0);
    const [awayGoals, setAwayGoals] = useState(existing?.awayGoals ?? 0);
    const [goals, setGoals] = useState(() => (existing?.goals ?? []).map((entry) => ({
        clubId: entry.clubId,
        playerId: entry.playerId,
        name: entry.name,
        count: entry.count,
    })));
    const [yellows, setYellows] = useState(() => (existing?.yellowCards ?? []).map((entry) => ({
        clubId: entry.clubId,
        playerId: entry.playerId,
        name: entry.name,
    })));
    const [reds, setReds] = useState(() => (existing?.redCards ?? []).map((entry) => ({
        clubId: entry.clubId,
        playerId: entry.playerId,
        name: entry.name,
    })));
    const [injuries, setInjuries] = useState(() => (existing?.injuries ?? []).map((entry) => ({
        clubId: entry.clubId,
        playerId: entry.playerId,
        name: entry.name,
        matchdays: entry.matchdays,
    })));
    const [selectedHome, setSelectedHome] = useState("");
    const [selectedAway, setSelectedAway] = useState("");
    const [injuryDays, setInjuryDays] = useState(2);
    const [busy, setBusy] = useState(false);
    const homeClubId = fixture.home.clubId;
    const awayClubId = fixture.away.clubId;
    const forClub = (rows, clubId) => rows.filter((row) => row.clubId === clubId);
    const homeGoalSum = forClub(goals, homeClubId).reduce((sum, goal) => sum + goal.count, 0);
    const awayGoalSum = forClub(goals, awayClubId).reduce((sum, goal) => sum + goal.count, 0);
    const canSave = (data.home.players.length === 0 || homeGoalSum === homeGoals) &&
        (data.away.players.length === 0 || awayGoalSum === awayGoals);
    const save = async () => {
        setBusy(true);
        try {
            const result = await submit({
                fixtureId: fixture.id,
                homeGoals,
                awayGoals,
                goals: goals.map((entry) => ({
                    clubId: entry.clubId,
                    playerId: entry.playerId,
                    count: entry.count,
                })),
                yellowCards: yellows.map((entry) => ({ clubId: entry.clubId, playerId: entry.playerId })),
                redCards: reds.map((entry) => ({ clubId: entry.clubId, playerId: entry.playerId })),
                injuries: injuries.map((entry) => ({
                    clubId: entry.clubId,
                    playerId: entry.playerId,
                    matchdays: entry.matchdays,
                })),
            });
            toast.success("Resultado registrado", {
                description: `${fixture.home.name} ${result.homeGoals}–${result.awayGoals} ${fixture.away.name}${result.injured ? ` · ${result.injured} jugador(es) lesionado(s)` : ""}.`,
            });
            onDone();
        }
        catch (cause) {
            toast.error("No se pudo registrar el resultado", {
                description: errorMessage(cause),
            });
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end", children: [_jsx(SideScore, { label: fixture.home.name, value: homeGoals, onChange: setHomeGoals }), _jsx("span", { className: "display pb-2 text-center text-xl text-muted-foreground", children: "\u2013" }), _jsx(SideScore, { label: fixture.away.name, value: awayGoals, onChange: setAwayGoals })] }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-2", children: [_jsx(SideColumn, { title: fixture.home.name, side: data.home, goals: forClub(goals, homeClubId), yellows: forClub(yellows, homeClubId), reds: forClub(reds, homeClubId), injuries: forClub(injuries, homeClubId), selection: selectedHome, setSelection: setSelectedHome, injuryDays: injuryDays, setInjuryDays: setInjuryDays, onAddGoal: (playerId, name) => setGoals((previous) => {
                            const existingGoal = previous.find((entry) => entry.playerId === playerId && entry.clubId === homeClubId);
                            if (existingGoal) {
                                return previous.map((entry) => entry === existingGoal ? { ...entry, count: entry.count + 1 } : entry);
                            }
                            return [...previous, { clubId: homeClubId, playerId, name, count: 1 }];
                        }), onBumpGoal: (playerId, delta) => setGoals((previous) => previous
                            .map((entry) => entry.playerId === playerId && entry.clubId === homeClubId
                            ? { ...entry, count: entry.count + delta }
                            : entry)
                            .filter((entry) => entry.count > 0)), onAddCard: (kind, playerId, name) => {
                            const row = { clubId: homeClubId, playerId, name };
                            if (kind === "amarilla")
                                setYellows((previous) => [...previous, row]);
                            else
                                setReds((previous) => [...previous, row]);
                        }, onRemoveCard: (kind, playerId) => {
                            if (kind === "amarilla") {
                                setYellows((previous) => {
                                    const index = previous.findIndex((entry) => entry.playerId === playerId && entry.clubId === homeClubId);
                                    return previous.filter((_, position) => position !== index);
                                });
                            }
                            else {
                                setReds((previous) => {
                                    const index = previous.findIndex((entry) => entry.playerId === playerId && entry.clubId === homeClubId);
                                    return previous.filter((_, position) => position !== index);
                                });
                            }
                        }, onAddInjury: (playerId, name) => setInjuries((previous) => [
                            ...previous.filter((entry) => !(entry.playerId === playerId && entry.clubId === homeClubId)),
                            { clubId: homeClubId, playerId, name, matchdays: injuryDays },
                        ]), onRemoveInjury: (playerId) => setInjuries((previous) => previous.filter((entry) => !(entry.playerId === playerId && entry.clubId === homeClubId))), goalSum: homeGoalSum, score: homeGoals }), _jsx(SideColumn, { title: fixture.away.name, side: data.away, goals: forClub(goals, awayClubId), yellows: forClub(yellows, awayClubId), reds: forClub(reds, awayClubId), injuries: forClub(injuries, awayClubId), selection: selectedAway, setSelection: setSelectedAway, injuryDays: injuryDays, setInjuryDays: setInjuryDays, onAddGoal: (playerId, name) => setGoals((previous) => {
                            const existingGoal = previous.find((entry) => entry.playerId === playerId && entry.clubId === awayClubId);
                            if (existingGoal) {
                                return previous.map((entry) => entry === existingGoal ? { ...entry, count: entry.count + 1 } : entry);
                            }
                            return [...previous, { clubId: awayClubId, playerId, name, count: 1 }];
                        }), onBumpGoal: (playerId, delta) => setGoals((previous) => previous
                            .map((entry) => entry.playerId === playerId && entry.clubId === awayClubId
                            ? { ...entry, count: entry.count + delta }
                            : entry)
                            .filter((entry) => entry.count > 0)), onAddCard: (kind, playerId, name) => {
                            const row = { clubId: awayClubId, playerId, name };
                            if (kind === "amarilla")
                                setYellows((previous) => [...previous, row]);
                            else
                                setReds((previous) => [...previous, row]);
                        }, onRemoveCard: (kind, playerId) => {
                            if (kind === "amarilla") {
                                setYellows((previous) => {
                                    const index = previous.findIndex((entry) => entry.playerId === playerId && entry.clubId === awayClubId);
                                    return previous.filter((_, position) => position !== index);
                                });
                            }
                            else {
                                setReds((previous) => {
                                    const index = previous.findIndex((entry) => entry.playerId === playerId && entry.clubId === awayClubId);
                                    return previous.filter((_, position) => position !== index);
                                });
                            }
                        }, onAddInjury: (playerId, name) => setInjuries((previous) => [
                            ...previous.filter((entry) => !(entry.playerId === playerId && entry.clubId === awayClubId)),
                            { clubId: awayClubId, playerId, name, matchdays: injuryDays },
                        ]), onRemoveInjury: (playerId) => setInjuries((previous) => previous.filter((entry) => !(entry.playerId === playerId && entry.clubId === awayClubId))), goalSum: awayGoalSum, score: awayGoals })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsxs(Button, { type: "button", className: "min-h-11", disabled: busy || !canSave, onClick: () => void save(), children: [busy ? (_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" })) : (_jsx(Save, { className: "size-4", "aria-hidden": "true" })), "Guardar resultado"] }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: canSave
                            ? existing
                                ? "Se actualizará el resultado detallado existente."
                                : "Se publicará en la tabla del torneo y la auditoría."
                            : `Los goles por jugador deben sumar el marcador (${homeGoalSum}/${homeGoals} local · ${awayGoalSum}/${awayGoals} visitante).` })] })] }));
}
function SideScore({ label, value, onChange, }) {
    return (_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("span", { className: "truncate text-xs font-semibold", children: label }), _jsx(Input, { type: "number", min: 0, max: 30, "aria-label": `Goles de ${label}`, className: "h-12 display text-center text-2xl", value: value, onChange: (event) => onChange(Math.max(0, Number(event.target.value) || 0)) })] }));
}
function SideColumn({ title, side, goals, yellows, reds, injuries, selection, setSelection, injuryDays, setInjuryDays, onAddGoal, onBumpGoal, onAddCard, onRemoveCard, onAddInjury, onRemoveInjury, goalSum, score, }) {
    const goalChips = useMemo(() => grouped(goals), [goals]);
    const yellowChips = useMemo(() => grouped(yellows), [yellows]);
    const redChips = useMemo(() => grouped(reds), [reds]);
    const injuryChips = useMemo(() => injuries.map((entry) => ({
        playerId: entry.playerId,
        name: entry.name,
        matchdays: entry.matchdays,
    })), [injuries]);
    const selectedName = side.players.find((player) => player.playerId === selection)?.name ?? "";
    const playerSelect = (_jsxs(Select, { value: selection, onValueChange: setSelection, children: [_jsx(SelectTrigger, { className: "h-10 min-w-0", "aria-label": `Jugador de ${title}`, children: _jsx(SelectValue, { placeholder: "Selecciona un jugador" }) }), _jsx(SelectContent, { className: "max-h-64", children: side.players.length === 0 ? (_jsx(SelectItem, { value: "none", disabled: true, children: "Sin jugadores en la plantilla" })) : (side.players.map((player) => (_jsxs(SelectItem, { value: player.playerId, children: [player.name, _jsxs("span", { className: "text-muted-foreground", children: [" ", "\u00B7 ", player.position, " \u00B7 ", player.ovr, " OVR"] })] }, player.playerId)))) })] }));
    const canAct = selection !== "" && selection !== "none";
    return (_jsxs("section", { className: "flex flex-col gap-3 rounded-xl border p-3", children: [_jsxs("header", { className: "flex items-center justify-between gap-2", children: [_jsx("h4", { className: "display truncate text-sm", children: title }), _jsxs("span", { className: cn("num rounded-md px-2 py-0.5 text-[11px] font-bold", goalSum === score
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300"), children: [goalSum, "/", score, " goles asignados"] })] }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("span", { className: "text-[10px] font-bold uppercase tracking-wide text-muted-foreground", children: "Goles por jugador" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("div", { className: "min-w-0 flex-1", children: playerSelect }), _jsxs(Button, { type: "button", variant: "outline", className: "h-10 shrink-0", disabled: !canAct, onClick: () => {
                                    const player = side.players.find((row) => row.playerId === selection);
                                    if (player)
                                        onAddGoal(player.playerId, player.name);
                                }, children: [_jsx(Plus, { className: "size-4", "aria-hidden": "true" }), "Gol"] })] }), goalChips.length > 0 ? (_jsx("ul", { className: "flex flex-wrap gap-1.5", children: goalChips.map((chip) => (_jsxs("li", { className: "flex items-center gap-1 rounded-md border bg-muted/50 px-1.5 py-1 text-[11px]", children: [_jsx("span", { className: "font-semibold", children: chip.name }), _jsxs("span", { className: "num font-bold text-primary", children: ["\u00D7", chip.count] }), _jsx("button", { type: "button", "aria-label": `Quitar un gol de ${chip.name}`, className: "rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground", onClick: () => onBumpGoal(chip.playerId, -1), children: "\u2212" }), _jsx("button", { type: "button", "aria-label": `Añadir un gol de ${chip.name}`, className: "rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground", onClick: () => onBumpGoal(chip.playerId, 1), children: "+" })] }, chip.playerId))) })) : (_jsx("p", { className: "text-[11px] text-muted-foreground", children: "Sin goles asignados todav\u00EDa." }))] }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("span", { className: "text-[10px] font-bold uppercase tracking-wide text-muted-foreground", children: "Tarjetas por jugador" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs(Button, { type: "button", variant: "outline", className: "h-10", disabled: !canAct, onClick: () => {
                                    const player = side.players.find((row) => row.playerId === selection);
                                    if (player)
                                        onAddCard("amarilla", player.playerId, player.name);
                                }, children: [_jsx("span", { "aria-hidden": "true", className: "size-3 rounded-sm bg-amber-400" }), "Amarilla"] }), _jsxs(Button, { type: "button", variant: "outline", className: "h-10", disabled: !canAct, onClick: () => {
                                    const player = side.players.find((row) => row.playerId === selection);
                                    if (player)
                                        onAddCard("roja", player.playerId, player.name);
                                }, children: [_jsx("span", { "aria-hidden": "true", className: "size-3 rounded-sm bg-rose-600" }), "Roja"] })] }), yellowChips.length + redChips.length > 0 ? (_jsxs("ul", { className: "flex flex-wrap gap-1.5", children: [yellowChips.map((chip) => (_jsxs("li", { className: "flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-1 text-[11px]", children: [_jsx("span", { "aria-hidden": "true", className: "size-2.5 rounded-sm bg-amber-400" }), _jsx("span", { className: "font-semibold", children: chip.name }), chip.count > 1 ? _jsxs("span", { className: "num font-bold", children: ["\u00D7", chip.count] }) : null, _jsx("button", { type: "button", "aria-label": `Quitar una amarilla de ${chip.name}`, className: "rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground", onClick: () => onRemoveCard("amarilla", chip.playerId), children: _jsx(X, { className: "size-3", "aria-hidden": "true" }) })] }, `y-${chip.playerId}`))), redChips.map((chip) => (_jsxs("li", { className: "flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-1.5 py-1 text-[11px]", children: [_jsx("span", { "aria-hidden": "true", className: "size-2.5 rounded-sm bg-rose-600" }), _jsx("span", { className: "font-semibold", children: chip.name }), chip.count > 1 ? _jsxs("span", { className: "num font-bold", children: ["\u00D7", chip.count] }) : null, _jsx("button", { type: "button", "aria-label": `Quitar una roja de ${chip.name}`, className: "rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground", onClick: () => onRemoveCard("roja", chip.playerId), children: _jsx(X, { className: "size-3", "aria-hidden": "true" }) })] }, `r-${chip.playerId}`)))] })) : (_jsx("p", { className: "text-[11px] text-muted-foreground", children: "Sin tarjetas registradas." }))] }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsxs("span", { className: "flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground", children: [_jsx(Stethoscope, { className: "size-3", "aria-hidden": "true" }), "Lesiones (jugador + duraci\u00F3n)"] }), _jsxs("div", { className: "grid grid-cols-[1fr_5rem_auto] gap-2", children: [playerSelect, _jsx(Input, { type: "number", min: 1, max: 60, "aria-label": "Jornadas de baja", className: "h-10", value: injuryDays, onChange: (event) => setInjuryDays(Math.min(60, Math.max(1, Number(event.target.value) || 1))) }), _jsx(Button, { type: "button", variant: "outline", className: "h-10", disabled: !canAct, onClick: () => {
                                    const player = side.players.find((row) => row.playerId === selection);
                                    if (player)
                                        onAddInjury(player.playerId, player.name);
                                }, children: _jsx(Plus, { className: "size-4", "aria-hidden": "true" }) })] }), injuryChips.length > 0 ? (_jsx("ul", { className: "flex flex-wrap gap-1.5", children: injuryChips.map((chip) => (_jsxs("li", { className: "flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/[0.08] px-1.5 py-1 text-[11px]", children: [_jsx("span", { className: "font-semibold", children: chip.name }), _jsxs("span", { className: "num text-muted-foreground", children: [chip.matchdays, " jornada(s)"] }), _jsx("button", { type: "button", "aria-label": `Quitar la lesión de ${chip.name}`, className: "rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground", onClick: () => onRemoveInjury(chip.playerId), children: _jsx(X, { className: "size-3", "aria-hidden": "true" }) })] }, chip.playerId))) })) : (_jsx("p", { className: "text-[11px] text-muted-foreground", children: "Sin lesionados en este partido." }))] }), _jsxs("p", { className: "text-[11px] text-muted-foreground", children: ["El jugador seleccionado ahora es \u00AB", selectedName || "—", "\u00BB: \u00FAsalo para goles, tarjetas o lesi\u00F3n."] })] }));
}
