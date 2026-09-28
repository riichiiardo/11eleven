import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { formatMoney, POSITION_LABEL, } from "@/convex/rulesEngine";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AvailabilityPicker, PlayerAvatar, PlayerFlag } from "./PlayerBits";
import { Loader2, Shirt, Sparkles } from "lucide-react";
/**
 * Deriva las seis facetas del FC (ritmo, tiro, pase, regate, defensa, físico)
 * desde el OVR, la posición y la edad. Es una lectura determinista del
 * snapshot: misma entrada, mismos números, sin invocar servicios externos.
 */
function facetProfile(ovr, position, group, age) {
    const clamp = (n) => Math.min(99, Math.max(24, Math.round(n)));
    const prime = age <= 28 ? 1 : Math.max(0.88, 1 - (age - 28) * 0.018);
    const youth = age <= 21 ? 0.965 : 1;
    const base = ovr * prime * youth;
    const spread = Math.round(ovr * 0.42); // energía posicional repartida
    switch (position) {
        case "POR":
            return [
                { code: "DIV", label: "Estirada", value: clamp(base + spread * 0.4) },
                { code: "MAN", label: "Manos", value: clamp(base + spread * 0.2) },
                { code: "KIC", label: "Saque", value: clamp(base - spread * 0.5) },
                { code: "REF", label: "Reflejos", value: clamp(base + spread * 0.5) },
                { code: "SPD", label: "Velocidad", value: clamp(base - spread * 0.9) },
                { code: "POS", label: "Colocación", value: clamp(base + spread * 0.3) },
            ];
        case "DFC":
        case "LD":
        case "LI":
            return [
                { code: "RIT", label: "Ritmo", value: clamp(base + (position === "DFC" ? -spread * 0.6 : spread * 0.5)) },
                { code: "TIR", label: "Tiro", value: clamp(base - spread * 1.4) },
                { code: "PAS", label: "Pase", value: clamp(base - spread * 0.4) },
                { code: "REG", label: "Regate", value: clamp(base - spread * 0.8) },
                { code: "DEF", label: "Defensa", value: clamp(base + spread * (position === "DFC" ? 0.9 : 0.4)) },
                { code: "FIS", label: "Físico", value: clamp(base + spread * 0.6) },
            ];
        case "MCD":
        case "MC":
        case "MCO":
            return [
                { code: "RIT", label: "Ritmo", value: clamp(base + (position === "MCD" ? -spread * 0.4 : spread * 0.1)) },
                { code: "TIR", label: "Tiro", value: clamp(base + (position === "MCO" ? spread * 0.3 : -spread * 0.6)) },
                { code: "PAS", label: "Pase", value: clamp(base + spread * 0.7) },
                { code: "REG", label: "Regate", value: clamp(base + spread * 0.3) },
                { code: "DEF", label: "Defensa", value: clamp(base + (position === "MCD" ? spread * 0.3 : -spread * 1.2)) },
                { code: "FIS", label: "Físico", value: clamp(base - spread * 0.1) },
            ];
        case "EI":
        case "ED":
            return [
                { code: "RIT", label: "Ritmo", value: clamp(base + spread * 0.9) },
                { code: "TIR", label: "Tiro", value: clamp(base - spread * 0.1) },
                { code: "PAS", label: "Pase", value: clamp(base + spread * 0.1) },
                { code: "REG", label: "Regate", value: clamp(base + spread * 0.8) },
                { code: "DEF", label: "Defensa", value: clamp(base - spread * 1.6) },
                { code: "FIS", label: "Físico", value: clamp(base - spread * 0.5) },
            ];
        case "DC":
        default:
            return [
                { code: "RIT", label: "Ritmo", value: clamp(base + spread * 0.4) },
                { code: "TIR", label: "Tiro", value: clamp(base + spread * 1.0) },
                { code: "PAS", label: "Pase", value: clamp(base - spread * 0.9) },
                { code: "REG", label: "Regate", value: clamp(base - spread * 0.2) },
                { code: "DEF", label: "Defensa", value: clamp(base - spread * 1.8) },
                { code: "FIS", label: "Físico", value: clamp(base + spread * 0.7) },
            ];
    }
}
export function PlayerDialog({ player, open, onOpenChange, onAssign, assignLabel, onSaveAvailability, saving, }) {
    const [draft, setDraft] = useState(null);
    const current = useMemo(() => (player ? draft ?? player.availability : null), [player, draft]);
    if (!player)
        return null;
    const facets = facetProfile(player.ovr, player.position, player.group, player.age);
    const close = (next) => {
        if (!next)
            setDraft(null);
        onOpenChange(next);
    };
    return (_jsx(Dialog, { open: open, onOpenChange: close, children: _jsxs(DialogContent, { className: "max-h-[92vh] overflow-y-auto scroll-thin gap-0 p-0 sm:max-w-md", children: [_jsxs("div", { className: "relative overflow-hidden rounded-t-xl bg-gradient-to-br from-navy via-navy-deep to-pitch/40 p-5 text-white", children: [_jsx("div", { "aria-hidden": "true", className: "pointer-events-none absolute -right-10 -top-14 size-44 rounded-full bg-white/5" }), _jsx("div", { "aria-hidden": "true", className: "pointer-events-none absolute -bottom-16 -left-8 size-36 rounded-full bg-brand/25" }), _jsxs(DialogHeader, { className: "space-y-0", children: [_jsxs(DialogTitle, { className: "sr-only", children: ["Ficha detallada de ", player.name] }), _jsxs(DialogDescription, { className: "sr-only", children: ["Todos los datos del cat\u00E1logo FC 27 de ", player.name, "."] })] }), _jsxs("div", { className: "relative flex items-center gap-4", children: [_jsx(PlayerAvatar, { name: player.name, flag: player.flag, group: player.group, size: "lg", photo: player.photo }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "num display text-3xl leading-none", children: player.ovr }), _jsx("span", { className: "display rounded-md bg-white/15 px-1.5 py-0.5 text-xs font-bold tracking-wide", children: player.position })] }), _jsx("p", { className: "display mt-1.5 truncate text-lg leading-tight", children: player.name }), _jsxs("p", { className: "mt-0.5 flex items-center gap-1.5 truncate text-xs text-white/75", children: [_jsx(PlayerFlag, { flag: player.flag, className: "h-4" }), player.nationality] })] })] }), _jsx("p", { className: "num relative mt-3 text-xl font-bold text-brand-bright", children: formatMoney(player.value) })] }), _jsxs("div", { className: "flex flex-col gap-4 p-5", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[11px] font-bold uppercase tracking-wider text-muted-foreground", children: "Atributos del FC 27" }), _jsx("div", { className: "mt-2 grid grid-cols-3 gap-2", children: facets.map((facet) => (_jsxs("div", { className: "rounded-lg border bg-muted/30 p-2 text-center", children: [_jsx("p", { className: "num display text-lg leading-none font-bold", children: facet.value }), _jsxs("p", { className: "mt-1 text-[10px] font-semibold text-muted-foreground", children: [facet.code, " \u00B7 ", facet.label] })] }, facet.code))) })] }), _jsx(Separator, {}), _jsxs("dl", { className: "grid grid-cols-2 gap-2 text-sm", children: [[
                                    { term: "Nacionalidad", value: `${player.flag} ${player.nationality}` },
                                    { term: "Posición", value: POSITION_LABEL[player.position] },
                                    { term: "Edad", value: `${player.age} años` },
                                    { term: "OVR", value: String(player.ovr) },
                                    { term: "Club de origen", value: player.realClub },
                                    { term: "Liga de origen", value: player.realLeague },
                                    { term: "Valoración", value: formatMoney(player.value) },
                                    { term: "Situación", value: player.availability },
                                ].map((item) => (_jsxs("div", { className: "rounded-lg border p-2.5", children: [_jsx("dt", { className: "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground", children: item.term }), _jsx("dd", { className: "mt-0.5 truncate text-xs font-semibold", children: item.value })] }, item.term))), _jsxs("div", { className: "col-span-2 rounded-lg border bg-muted/30 p-2.5", children: [_jsx("dt", { className: "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground", children: "Datos de origen" }), _jsxs("dd", { className: "mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground", children: [_jsx(Sparkles, { className: "size-3.5 shrink-0", "aria-hidden": "true" }), player.fcVersion] })] })] }), _jsx(Separator, {}), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: "Situaci\u00F3n en el mercado" }), current ? (_jsx(AvailabilityPicker, { value: current, disabled: saving, onChange: (next) => setDraft(next) })) : null, draft && draft !== player.availability ? (_jsx(Button, { type: "button", className: "min-h-11", disabled: saving, onClick: async () => {
                                        await onSaveAvailability(player.playerId, draft);
                                        setDraft(null);
                                    }, children: saving ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" }), "Guardando\u2026"] })) : ("Guardar situación") })) : null] }), onAssign ? (_jsxs(_Fragment, { children: [_jsx(Separator, {}), _jsxs(Button, { type: "button", variant: "outline", className: "min-h-11", onClick: () => {
                                        onAssign(player);
                                        close(false);
                                    }, children: [_jsx(Shirt, { className: "size-4", "aria-hidden": "true" }), assignLabel ?? "Fijar en el XI"] })] })) : null] })] }) }));
}
