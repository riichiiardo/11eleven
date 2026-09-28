import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RULE_DESCRIPTORS } from "@/convex/rulesEngine";
import { useOutletContext } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SectionCard } from "@/components/eleven/SectionCard";
import { RuleCheckList } from "@/components/eleven/RuleCheckList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router";
import { BookOpen, Gauge, Scale } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
const SCOPE_CLASS = {
    Club: "border-brand/30 bg-brand/10 text-primary",
    Plantilla: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    Mercado: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    Competición: "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
};
export default function Rules() {
    const state = useOutletContext();
    const rules = state.rules;
    const updateRules = useMutation(api.tournament.updateRules);
    if (!rules || !state.tournament)
        return null;
    return (_jsxs("div", { className: "mx-auto flex w-full max-w-[1400px] flex-col gap-5", children: [_jsxs("header", { className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "display text-2xl", children: "Reglas del torneo" }), _jsxs("p", { className: "mt-1 max-w-3xl text-sm text-muted-foreground", children: [state.tournament.name, " \u00B7 ", state.tournament.season, ". Estas reglas se aplican en cada operaci\u00F3n del producto: el mismo motor valida en el navegador y en el servidor, as\u00ED que ninguna pantalla puede prometer algo que el torneo no permita."] })] }), state.isAdmin ? (_jsx(Button, { asChild: true, className: "min-h-11", children: _jsxs(Link, { to: "/dashboard/admin", children: [_jsx(Gauge, { className: "size-4", "aria-hidden": "true" }), "Editar desde Administraci\u00F3n"] }) })) : null] }), _jsxs("div", { className: "grid gap-5 xl:grid-cols-3", children: [_jsx(SectionCard, { title: "Matriz de reglas vigentes", icon: Scale, className: "xl:col-span-2", bodyClassName: "p-0", children: _jsx("ul", { className: "divide-y", children: RULE_DESCRIPTORS.map((descriptor) => (_jsxs("li", { className: "flex flex-col gap-2 p-4", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "display rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground", children: descriptor.code }), _jsx("p", { className: "text-sm font-bold", children: descriptor.title }), _jsx(Badge, { variant: "outline", className: SCOPE_CLASS[descriptor.scope] ?? "", children: descriptor.scope }), _jsx("span", { className: "num ml-auto text-sm font-bold text-primary", children: descriptor.value(rules) })] }), _jsx("p", { className: "text-xs leading-relaxed text-muted-foreground", children: descriptor.description })] }, descriptor.code))) }) }), _jsxs("div", { className: "flex flex-col gap-5", children: [_jsx(SectionCard, { title: "C\u00F3mo te afectan ahora", icon: BookOpen, children: _jsx(RuleCheckList, { checks: state.evaluation?.checks ?? [], variant: "full" }) }), _jsx(SectionCard, { title: "Reglas propias del torneo", icon: Scale, children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "mb-1.5 flex items-center gap-2 text-sm font-semibold", children: [_jsx("span", { className: "size-2 rounded-full bg-primary/20", "aria-hidden": "true" }), "M\u00EDnimo de sub-20 en el XI"] }), _jsx(Input, { type: "number", min: 0, max: 11, value: rules.u20Min, onChange: (event) => {
                                                        const value = Number(event.target.value);
                                                        updateRules({
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
                                                            fc27FormationCode: rules.fc27FormationCode,
                                                            formationInstructions: rules.formationInstructions,
                                                            u20Min: value,
                                                            u20InStartingLineup: rules.u20InStartingLineup,
                                                            sameNationalityMin: rules.sameNationalityMin,
                                                            sameNationalityRule: rules.sameNationalityRule,
                                                            sameNationalityMatchDurationMinutes: rules.sameNationalityMatchDurationMinutes,
                                                            clubNationalityMin: rules.clubNationalityMin,
                                                        });
                                                    }, "aria-label": "M\u00EDnimo de sub-20 en el XI", className: "font-mono" }), _jsx("p", { className: "mt-1.5 text-[11px] leading-relaxed text-muted-foreground", children: "N\u00BA de jugadores de 20 a\u00F1os o menos que el torneo exige alinear en cada encuentro." })] }), _jsxs("div", { children: [_jsxs("label", { className: "mb-1.5 flex items-center gap-2 text-sm font-semibold", children: [_jsx("span", { className: "size-2 rounded-full bg-primary/20", "aria-hidden": "true" }), "\u00BFDe d\u00F3nde sale el sub-20?"] }), _jsxs(Select, { value: rules.u20InStartingLineup ?? "ninguno", onValueChange: (value) => {
                                                        updateRules({
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
                                                            fc27FormationCode: rules.fc27FormationCode,
                                                            formationInstructions: rules.formationInstructions,
                                                            u20Min: rules.u20Min,
                                                            u20InStartingLineup: value === "ninguno"
                                                                ? null
                                                                : value,
                                                            sameNationalityMin: rules.sameNationalityMin,
                                                            sameNationalityRule: rules.sameNationalityRule,
                                                            sameNationalityMatchDurationMinutes: rules.sameNationalityMatchDurationMinutes,
                                                            clubNationalityMin: rules.clubNationalityMin,
                                                        });
                                                    }, children: [_jsx(SelectTrigger, { "aria-label": "R\u00E9gimen de sub-20", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "ninguno", children: "Sin regla" }), _jsx(SelectItem, { value: "obligatory", children: "Obligatorio desde el XI titular" }), _jsx(SelectItem, { value: "substitute", children: "Sustituible como reserva" })] })] })] }), _jsxs("div", { children: [_jsxs("label", { className: "mb-1.5 flex items-center gap-2 text-sm font-semibold", children: [_jsx("span", { className: "size-2 rounded-full bg-primary/20", "aria-hidden": "true" }), "M\u00EDnimo de jugadores de una misma nacionalidad"] }), _jsx(Input, { type: "number", min: 0, max: 22, value: rules.sameNationalityMin, onChange: (event) => {
                                                        const value = Number(event.target.value);
                                                        updateRules({
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
                                                            fc27FormationCode: rules.fc27FormationCode,
                                                            formationInstructions: rules.formationInstructions,
                                                            u20Min: rules.u20Min,
                                                            u20InStartingLineup: rules.u20InStartingLineup,
                                                            sameNationalityMin: value,
                                                            sameNationalityRule: rules.sameNationalityRule,
                                                            sameNationalityMatchDurationMinutes: rules.sameNationalityMatchDurationMinutes,
                                                            clubNationalityMin: rules.clubNationalityMin,
                                                        });
                                                    }, "aria-label": "M\u00EDnimo de jugadores de una misma nacionalidad", className: "font-mono" }), _jsx("p", { className: "mt-1.5 text-[11px] leading-relaxed text-muted-foreground", children: "N\u00BA de jugadores de una misma nacionalidad que debe estar en campo en todo el golpe, sin importar qui\u00E9n sea el que juega." })] }), _jsxs("div", { children: [_jsxs("label", { className: "mb-1.5 flex items-center gap-2 text-sm font-semibold", children: [_jsx("span", { className: "size-2 rounded-full bg-primary/20", "aria-hidden": "true" }), "Regla de nacionalidad"] }), _jsxs(Select, { value: rules.sameNationalityRule ?? "ninguna", onValueChange: (value) => {
                                                        updateRules({
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
                                                            fc27FormationCode: rules.fc27FormationCode,
                                                            formationInstructions: rules.formationInstructions,
                                                            u20Min: rules.u20Min,
                                                            u20InStartingLineup: rules.u20InStartingLineup,
                                                            sameNationalityMin: rules.sameNationalityMin,
                                                            sameNationalityRule: value === "ninguna"
                                                                ? null
                                                                : value,
                                                            sameNationalityMatchDurationMinutes: rules.sameNationalityMatchDurationMinutes,
                                                            clubNationalityMin: rules.clubNationalityMin,
                                                        });
                                                    }, children: [_jsx(SelectTrigger, { "aria-label": "Regla de nacionalidad", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "ninguna", children: "Sin regla" }), _jsx(SelectItem, { value: "obligatory", children: "Siempre en campo (sin cambio)" }), _jsx(SelectItem, { value: "changeable", children: "Cambiable (puede alejarse)" })] })] })] }), _jsxs("div", { children: [_jsxs("label", { className: "mb-1.5 flex items-center gap-2 text-sm font-semibold", children: [_jsx("span", { className: "size-2 rounded-full bg-primary/20", "aria-hidden": "true" }), "Minutos de permanencia"] }), _jsx(Input, { type: "number", min: 0, max: 120, value: rules.sameNationalityMatchDurationMinutes, onChange: (event) => {
                                                        const value = Number(event.target.value);
                                                        updateRules({
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
                                                            fc27FormationCode: rules.fc27FormationCode,
                                                            formationInstructions: rules.formationInstructions,
                                                            u20Min: rules.u20Min,
                                                            u20InStartingLineup: rules.u20InStartingLineup,
                                                            sameNationalityMin: rules.sameNationalityMin,
                                                            sameNationalityRule: rules.sameNationalityRule,
                                                            sameNationalityMatchDurationMinutes: value,
                                                            clubNationalityMin: rules.clubNationalityMin,
                                                        });
                                                    }, "aria-label": "Minutos de permanencia de la regla de nacionalidad", className: "font-mono" }), _jsx("p", { className: "mt-1.5 text-[11px] leading-relaxed text-muted-foreground", children: "Si la regla de nacionalidad es \"cambiable\", el jugador puede alejarse este n\u00FAmero de minutos de permanencia en el encuentro." })] })] }) })] })] })] }));
}
