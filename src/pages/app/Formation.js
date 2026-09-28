import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { FORMATIONS, FORMATION_CODES, evaluateLineup, isFormationCode, formatMoney, remapLineup, autoLineup, POSITION_LABEL, } from "@/convex/rulesEngine";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";
import { useLocation, useOutletContext } from "react-router";
import { SectionCard } from "@/components/eleven/SectionCard";
import { PitchView } from "@/components/eleven/PitchView";
import { RuleCheckList } from "@/components/eleven/RuleCheckList";
import { OvrBadge, PlayerAvatar, PositionPill } from "@/components/eleven/PlayerBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, RotateCcw, Search, Shirt, Sparkles, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
export default function Formation() {
    const state = useOutletContext();
    const location = useLocation();
    const saveLineup = useMutation(api.squads.saveLineup);
    const autoFill = useMutation(api.squads.autoFillLineup);
    const updateRules = useMutation(api.tournament.updateRules);
    const serverLineup = state.lineup;
    // "Alinear en el XI" from the squad page arrives with the player pre-selected.
    const incomingPlayerId = location.state?.playerId ?? null;
    const [draft, setDraft] = useState(null);
    const [selectedPlayerId, setSelectedPlayerId] = useState(incomingPlayerId);
    const [query, setQuery] = useState("");
    const [busy, setBusy] = useState(false);
    const lineup = draft ?? serverLineup;
    const rules = state.rules;
    const squad = state.squad;
    const [fc27Code, setFc27Code] = useState(rules?.fc27FormationCode ?? "");
    const [instructions, setInstructions] = useState(rules?.formationInstructions ?? "");
    const evaluation = useMemo(() => rules && lineup
        ? evaluateLineup(rules, squad, lineup, state.evaluation ?? undefined)
        : null, [rules, squad, lineup, state.evaluation]);
    const assignedIds = new Set((lineup?.slots ?? [])
        .map((slot) => slot.playerId)
        .filter((id) => Boolean(id)));
    const selectedPlayer = squad.find((player) => player.playerId === selectedPlayerId) ?? null;
    const bench = squad
        .filter((player) => !assignedIds.has(player.playerId))
        .sort((a, b) => b.ovr - a.ovr);
    const filteredBench = bench.filter((player) => {
        const term = query.trim().toLowerCase();
        if (!term)
            return true;
        return (player.name.toLowerCase().includes(term) ||
            player.position.toLowerCase().includes(term) ||
            player.nationality.toLowerCase().includes(term));
    });
    if (!rules || !lineup || !evaluation || !state.club)
        return null;
    const definition = FORMATIONS[lineup.formation];
    const formationChanged = draft ? draft.formation !== serverLineup?.formation : false;
    const isDirty = Boolean(draft);
    const highlight = selectedPlayer
        ? {
            valid: new Set(definition.slots
                .filter((slot) => slot.accepts.includes(selectedPlayer.position))
                .map((slot) => slot.id)),
            invalid: new Set(definition.slots
                .filter((slot) => !slot.accepts.includes(selectedPlayer.position))
                .map((slot) => slot.id)),
        }
        : undefined;
    const assignToSlot = (slotId) => {
        if (!selectedPlayer)
            return;
        const slot = definition.slots.find((item) => item.id === slotId);
        if (!slot)
            return;
        if (!slot.accepts.includes(selectedPlayer.position)) {
            toast.error("Posición incompatible", {
                description: `${selectedPlayer.name} (${selectedPlayer.position}) no puede ocupar ${POSITION_LABEL[slot.label]} en esta formación.`,
            });
            return;
        }
        const nextSlots = definition.slots.map((item) => {
            const current = lineup.slots.find((entry) => entry.slotId === item.id)?.playerId ?? null;
            if (item.id === slotId)
                return { slotId: item.id, playerId: selectedPlayer.playerId };
            if (current === selectedPlayer.playerId)
                return { slotId: item.id, playerId: null };
            return { slotId: item.id, playerId: current };
        });
        setDraft({ formation: lineup.formation, slots: nextSlots });
        setSelectedPlayerId(null);
    };
    const handleSlotClick = (slotId) => {
        if (selectedPlayer) {
            assignToSlot(slotId);
            return;
        }
        const playerId = lineup.slots.find((slot) => slot.slotId === slotId)?.playerId ?? null;
        if (playerId) {
            setSelectedPlayerId(playerId);
        }
        else {
            toast.info("Elige primero un jugador", {
                description: "Selecciona un jugador del banquillo y después la posición donde quieres alinearlo.",
            });
        }
    };
    const removeFromLineup = (playerId) => {
        setDraft({
            formation: lineup.formation,
            slots: lineup.slots.map((slot) => slot.playerId === playerId ? { slotId: slot.slotId, playerId: null } : slot),
        });
        setSelectedPlayerId(null);
    };
    const changeFormation = (code) => {
        setDraft(remapLineup(squad, code, lineup));
        setSelectedPlayerId(null);
    };
    /** "Automática": descarta cualquier cambio de esquema pendiente y deja el once tal cual. */
    const keepAutomaticFormation = () => {
        setDraft(null);
        setSelectedPlayerId(null);
    };
    const runAuto = () => {
        setDraft(autoLineup(squad, lineup.formation));
        setSelectedPlayerId(null);
        toast.info("Once propuesto por el motor", {
            description: "Se alinean los jugadores con mayor OVR en cada posición. Revísalo y guarda para confirmar.",
        });
    };
    const persist = async () => {
        setBusy(true);
        try {
            await saveLineup({
                formation: lineup.formation,
                slots: lineup.slots,
            });
            await updateRules({
                budget: rules.budget,
                squadSize: rules.squadSize,
                gkMin: rules.gkMin,
                gkMax: rules.gkMax,
                defMin: rules.defMin,
                defMax: rules.defMax,
                midMin: rules.midMin,
                midMax: rules.midMax,
                fwdMin: rules.fwdMin,
                fwdMax: rules.fwdMax,
                maxPerRealClub: rules.maxPerRealClub,
                minOvr: rules.minOvr,
                maxU21: rules.maxU21,
                lineupLockHours: rules.lineupLockHours,
                fc27FormationCode: fc27Code,
                formationInstructions: instructions,
                u20Min: rules.u20Min,
                u20InStartingLineup: rules.u20InStartingLineup,
                sameNationalityMin: rules.sameNationalityMin,
                sameNationalityRule: rules.sameNationalityRule,
                sameNationalityMatchDurationMinutes: rules.sameNationalityMatchDurationMinutes,
                clubNationalityMin: rules.clubNationalityMin,
            });
            setDraft(null);
            toast.success("Alineación guardada", {
                description: `${definition.label} · ${evaluation.starters.length} titulares verificados por el motor de reglas.`,
            });
        }
        catch (cause) {
            toast.error("No se pudo guardar la alineación", {
                description: errorMessage(cause),
            });
        }
        finally {
            setBusy(false);
        }
    };
    const persistAuto = async () => {
        setBusy(true);
        try {
            await autoFill({ formation: lineup.formation });
            setDraft(null);
            toast.success("Alineación automática aplicada", {
                description: "El motor eligió el mejor once posible y lo validó contra las reglas.",
            });
        }
        catch (cause) {
            toast.error("No se pudo aplicar la alineación automática", {
                description: errorMessage(cause),
            });
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: "mx-auto flex w-full max-w-[1400px] flex-col gap-5", children: [_jsxs("header", { className: "flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "display text-2xl", children: "Formaci\u00F3n y t\u00E1ctica" }), _jsx("p", { className: "mt-1 max-w-3xl text-sm text-muted-foreground", children: "Selecciona un jugador y despu\u00E9s la posici\u00F3n donde quieres alinearlo. No hace falta arrastrar: el flujo es compatible con teclado y lectores de pantalla." })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [isDirty ? (_jsx(Badge, { className: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300", children: "Cambios sin guardar" })) : (_jsxs(Badge, { className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", children: [_jsx(Check, { className: "size-3", "aria-hidden": "true" }), "Alineaci\u00F3n sincronizada"] })), isDirty ? (_jsxs(Button, { type: "button", variant: "outline", className: "min-h-11", onClick: () => {
                                    setDraft(null);
                                    setSelectedPlayerId(null);
                                }, children: [_jsx(RotateCcw, { className: "size-4", "aria-hidden": "true" }), "Descartar"] })) : null, _jsxs(Button, { type: "button", variant: "outline", className: "min-h-11", disabled: busy, onClick: runAuto, children: [_jsx(Wand2, { className: "size-4", "aria-hidden": "true" }), "Proponer once"] }), _jsx(Button, { type: "button", variant: "ghost", className: "min-h-11", disabled: busy, onClick: persistAuto, title: "Aplica y guarda directamente el once propuesto por el motor", children: "Guardar autom\u00E1tico" })] })] }), _jsxs(SectionCard, { title: "Esquema t\u00E1ctico", icon: Shirt, accent: "pitch", children: [_jsxs("div", { role: "radiogroup", "aria-label": "Formaci\u00F3n", className: "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6", children: [_jsxs("button", { type: "button", role: "radio", "aria-checked": !isFormationCode(lineup.formation), onClick: keepAutomaticFormation, title: "Mantiene el esquema actual sin fijar un c\u00F3digo del FC 27", className: cn("flex min-h-11 flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors", !isFormationCode(lineup.formation)
                                    ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                                    : "border-border hover:bg-accent"), children: [_jsx("span", { className: "display text-sm", children: "Autom\u00E1tica" }), _jsx("span", { className: "text-[11px] text-muted-foreground", children: "Sin c\u00F3digo fijo" })] }), FORMATION_CODES.map((code) => {
                                const option = FORMATIONS[code];
                                const active = code === lineup.formation;
                                return (_jsxs("button", { type: "button", role: "radio", "aria-checked": active, onClick: () => changeFormation(code), className: cn("flex min-h-11 flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors", active
                                        ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                                        : "border-border hover:bg-accent"), children: [_jsx("span", { className: "display text-sm", children: option.label }), _jsx("span", { className: "text-[11px] text-muted-foreground", children: option.shape })] }, code));
                            })] }), _jsxs("p", { className: "mt-3 text-xs leading-relaxed text-muted-foreground", children: [definition.description, formationChanged
                                ? " Al cambiar de esquema el motor recoloca a los jugadores compatibles y deja libres las posiciones que nadie puede cubrir."
                                : ""] }), _jsx("p", { className: "mt-1.5 text-[11px] leading-relaxed text-muted-foreground", children: "Los 22 esquemas replican el men\u00FA de t\u00E1cticas del FC 27: selecci\u00F3nalos para fijar el c\u00F3digo y recolocar el once, o pulsa \u00ABAutom\u00E1tica\u00BB para dejar el esquema libre." })] }), _jsx(SectionCard, { title: "Gui\u00F3n de formaci\u00F3n", icon: Shirt, accent: "pitch", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "mb-1.5 flex items-center gap-2 text-sm font-semibold", children: [_jsx("span", { className: "size-2 rounded-full bg-primary/20", "aria-hidden": "true" }), "C\u00F3digo de formaci\u00F3n FC 27"] }), _jsx(Input, { value: fc27Code, onChange: (event) => setFc27Code(event.target.value), placeholder: "ej. 4-2-3-1, 3-4-2-1, 4-1-2-1-2, 5-2-1-2\u2026", "aria-label": "C\u00F3digo de formaci\u00F3n FC 27", className: "font-mono" }), _jsx("p", { className: "mt-1.5 text-[11px] leading-relaxed text-muted-foreground", children: "El c\u00F3digo seleccionado se enlaza con los 22 esquemas del men\u00FA de t\u00E1cticas del FC 27 para generar un XI siempre legal. El estado real lo valida el motor de reglas." })] }), _jsxs("div", { children: [_jsxs("label", { className: "mb-1.5 flex items-center gap-2 text-sm font-semibold", children: [_jsx("span", { className: "size-2 rounded-full bg-primary/20", "aria-hidden": "true" }), "Instrucciones adicionales"] }), _jsx("textarea", { value: instructions, onChange: (event) => setInstructions(event.target.value), rows: 4, placeholder: "Ej: cambios en los minutos 60-75, base 4-2-3-1 con delanteros m\u00E1s anchos, bloquear mediocentro\u2026", "aria-label": "Instrucciones adicionales de formaci\u00F3n", className: "resize-y min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50" }), _jsx("p", { className: "mt-1.5 text-[11px] leading-relaxed text-muted-foreground", children: "Cambios, rango de minutos, bloqueos de posiciones\u2026 El presidente los anota aqu\u00ED y queda registrada en la config de reglas del torneo." })] })] }) }), _jsxs("div", { className: "grid gap-5 xl:grid-cols-3", children: [_jsx("div", { className: "flex flex-col gap-5 xl:col-span-2", children: _jsxs(SectionCard, { title: "Pizarra", icon: Shirt, accent: "pitch", action: { label: "Ver plantilla", to: "/dashboard/club/plantilla" }, children: [selectedPlayer ? (_jsxs("div", { className: "mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-brand/30 bg-brand/[0.06] p-3", children: [_jsx(PlayerAvatar, { name: selectedPlayer.name, flag: selectedPlayer.flag, group: selectedPlayer.group, size: "sm", photo: selectedPlayer.photo }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("p", { className: "text-sm font-semibold", children: ["Colocando a ", selectedPlayer.name] }), _jsxs("p", { className: "text-[11px] text-muted-foreground", children: [POSITION_LABEL[selectedPlayer.position], " \u00B7 OVR ", selectedPlayer.ovr, " \u00B7 posiciones resaltadas compatibles"] })] }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", className: "min-h-9", onClick: () => setSelectedPlayerId(null), children: [_jsx(X, { className: "size-3.5", "aria-hidden": "true" }), "Cancelar"] }), assignedIds.has(selectedPlayer.playerId) ? (_jsx(Button, { type: "button", variant: "outline", size: "sm", className: "min-h-9", onClick: () => removeFromLineup(selectedPlayer.playerId), children: "Quitar del once" })) : null] })) : (_jsx("p", { className: "mb-3 rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground", children: "Selecciona una posici\u00F3n ocupada para editar a ese jugador, o elige un jugador en el panel derecho para colocarlo en el campo." })), _jsx(PitchView, { formation: lineup.formation, lineup: lineup, squad: squad, mode: "edit", highlight: highlight, onSlotClick: handleSlotClick })] }) }), _jsxs("div", { className: "flex flex-col gap-5", children: [_jsxs(SectionCard, { title: "Validaci\u00F3n en vivo", icon: Sparkles, children: [_jsxs("div", { className: "mb-3 rounded-lg border p-3", children: [_jsx("p", { className: "display text-sm", children: evaluation.valid ? "Alineación válida" : "Alineación incompleta" }), _jsx("p", { className: "mt-1 text-xs leading-relaxed text-muted-foreground", children: evaluation.valid
                                                    ? "Puedes guardar: el once cumple posición, cupos y reglas del torneo."
                                                    : evaluation.errors[0] ??
                                                        evaluation.checks.find((check) => !check.passed)?.detail ??
                                                        "Completa el once para poder guardar." })] }), _jsx(RuleCheckList, { checks: evaluation.checks }), _jsx(Button, { type: "button", className: "mt-3 min-h-11 w-full", disabled: !evaluation.valid || !isDirty || busy, onClick: persist, children: busy ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" }), "Guardando\u2026"] })) : evaluation.valid ? (isDirty ? ("Guardar formación") : ("Sin cambios por guardar")) : ("Corrige los errores para guardar") }), _jsx("p", { className: "mt-2 text-[11px] leading-relaxed text-muted-foreground", children: "El mismo motor valida en el servidor: si algo cambia mientras editas, la operaci\u00F3n se rechaza con la explicaci\u00F3n exacta." })] }), _jsxs(SectionCard, { title: `Banquillo (${bench.length})`, icon: Shirt, bodyClassName: "p-0", children: [_jsx("div", { className: "border-b p-3", children: _jsxs("div", { className: "relative", children: [_jsx(Search, { className: "absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground", "aria-hidden": "true" }), _jsx(Input, { value: query, onChange: (event) => setQuery(event.target.value), placeholder: "Buscar en el banquillo\u2026", "aria-label": "Buscar jugador en el banquillo", className: "h-11 pl-9" })] }) }), _jsxs("ul", { className: "scroll-thin max-h-[420px] divide-y overflow-y-auto", children: [filteredBench.map((player) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => setSelectedPlayerId(player.playerId), "aria-pressed": selectedPlayerId === player.playerId, className: cn("flex min-h-14 w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent", selectedPlayerId === player.playerId && "bg-primary/5"), children: [_jsx(PlayerAvatar, { name: player.name, flag: player.flag, group: player.group, size: "xs", photo: player.photo }), _jsxs("span", { className: "min-w-0 flex-1", children: [_jsx("span", { className: "block truncate text-sm font-semibold", children: player.name }), _jsxs("span", { className: "mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground", children: [_jsx(PositionPill, { position: player.position, group: player.group }), formatMoney(player.value)] })] }), _jsx(OvrBadge, { ovr: player.ovr })] }) }, player.squadPlayerId))), filteredBench.length === 0 ? (_jsx("li", { className: "p-4 text-sm text-muted-foreground", children: "No quedan jugadores disponibles con ese filtro." })) : null] })] })] })] })] }));
}
