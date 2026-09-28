import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { formatMoney } from "@/convex/rulesEngine";
import { errorMessage } from "@/lib/errors";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Crest } from "@/components/eleven/Crest";
import { BrandLockup } from "@/components/eleven/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { CheckCircle2, Info, Loader2, Search, ShieldCheck, Globe, Flag, } from "lucide-react";
import { cn } from "@/lib/utils";
export default function ClubSelection({ state }) {
    const navigate = useNavigate();
    const chooseTeam = useMutation(api.tournament.chooseCatalogTeam);
    const ensureCatalog = useMutation(api.tournament.ensureTeamCatalog);
    const [query, setQuery] = useState("");
    const [healingCatalog, setHealingCatalog] = useState(false);
    const catalogRepair = useRef(false);
    // Self-heal: if the global catalogue is empty (fresh deployment or stale
    // test data), seed it once so the picker always has teams to show. The
    // mutation is idempotent and the state query refreshes reactively.
    useEffect(() => {
        if (catalogRepair.current || state.teamCatalog.length > 0)
            return;
        catalogRepair.current = true;
        setHealingCatalog(true);
        ensureCatalog()
            .then((result) => {
            if (result.inserted > 0) {
                toast.success("Catálogo de equipos cargado", {
                    description: `${result.inserted} equipos disponibles para elegir.`,
                });
            }
        })
            .catch((cause) => {
            catalogRepair.current = false;
            toast.error("No se pudo cargar el catálogo de equipos", {
                description: errorMessage(cause),
            });
        })
            .finally(() => setHealingCatalog(false));
    }, [state.teamCatalog.length, ensureCatalog]);
    const [country, setCountry] = useState("Todos");
    const [league, setLeague] = useState("Todas");
    const [candidate, setCandidate] = useState(null);
    const [saving, setSaving] = useState(false);
    const leagueOptions = useMemo(() => {
        const term = country.trim().toLowerCase();
        const leagues = state.teamCatalog
            .filter((club) => !term || club.country.toLowerCase().includes(term))
            .map((club) => club.league);
        return ["Todas", ...new Set(leagues)];
    }, [state.teamCatalog, country]);
    const visible = state.teamCatalog.filter((club) => {
        const countryTerm = country.trim().toLowerCase();
        const leagueTerm = league.trim().toLowerCase();
        const matchesCountry = country === "Todos" || !countryTerm || club.country.toLowerCase().includes(countryTerm);
        const matchesLeague = league === "Todas" || !leagueTerm || club.league.toLowerCase().includes(leagueTerm);
        const term = query.trim().toLowerCase();
        const matchesQuery = !term ||
            club.name.toLowerCase().includes(term) ||
            club.league.toLowerCase().includes(term) ||
            club.country.toLowerCase().includes(term);
        return matchesCountry && matchesLeague && matchesQuery;
    });
    const rules = state.rules;
    const isSkipable = state.isAdmin;
    const skipToRules = () => navigate("/dashboard/admin");
    const confirm = async () => {
        if (!candidate?.catalogTeamId)
            return;
        setSaving(true);
        try {
            await chooseTeam({ catalogTeamId: candidate.catalogTeamId });
            toast.success(`¡Bienvenido a ${candidate.name}!`, {
                description: "Tu plantilla arranca vacía: todo se decide en el primer draft.",
            });
            setCandidate(null);
        }
        catch (cause) {
            toast.error("No se pudo confirmar el equipo", { description: errorMessage(cause) });
        }
        finally {
            setSaving(false);
        }
    };
    const buildClubView = (entry) => ({
        id: entry.id,
        name: entry.name,
        league: entry.league,
        country: entry.country,
        colorPrimary: entry.colors[0],
        colorSecondary: entry.colors[1],
        shortName: entry.name.slice(0, 3).toUpperCase(),
        catalogTeamId: entry.id,
        presidentNickname: entry.takenByMe ? (state.president?.nickname ?? "Tú") : null,
        rosterSize: 0,
        averageOvr: 0,
        totalValue: 0,
        presidentName: entry.takenByMe ? state.president?.nickname ?? null : null,
    });
    return (_jsxs("div", { className: "rail-surface min-h-screen px-4 py-8 text-white sm:px-6 lg:py-12", children: [_jsxs("div", { className: "mx-auto flex w-full max-w-6xl flex-col gap-6", children: [_jsxs("header", { className: "flex flex-wrap items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx(BrandLockup, {}), _jsx("h1", { className: "display mt-6 text-3xl leading-tight sm:text-4xl", children: "Elige el equipo que vas a presidir" }), _jsxs("p", { className: "mt-2 max-w-2xl text-sm text-white/70", children: ["Hola ", state.user.name, ", dentro de", " ", _jsx("strong", { className: "font-semibold text-white", children: state.tournament?.name }), " ", "(", state.tournament?.season, "). Explora el cat\u00E1logo global de equipos por pa\u00EDs y liga. Tu plantilla arranca vac\u00EDa: la construir\u00E1s en el primer draft."] })] }), _jsxs("div", { className: "flex flex-col items-start gap-2 sm:items-end", children: [state.isAdmin ? (_jsxs(Badge, { className: "border-0 bg-gold/20 text-amber-100", children: [_jsx(ShieldCheck, { className: "size-3.5", "aria-hidden": "true" }), "Administrador de la liga"] })) : null, _jsxs("p", { className: "text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45", children: [state.teamCatalog.length, " equipos \u00B7", " ", new Set(state.teamCatalog.map((t) => t.country)).size, " pa\u00EDses \u00B7", " ", new Set(state.teamCatalog.map((t) => t.league)).size, " ligas"] })] })] }), isSkipable ? (_jsxs("button", { type: "button", onClick: skipToRules, className: "flex w-full items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2.5 text-sm font-semibold text-amber-200 transition-colors hover:bg-gold/20", children: [_jsx(ShieldCheck, { className: "size-4", "aria-hidden": "true" }), "Omitir elecci\u00F3n y configurar reglas primero"] })) : null, rules ? (_jsxs("section", { "aria-label": "Reglas clave de la liga", className: "grid gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4 sm:grid-cols-2 lg:grid-cols-4", children: [_jsx(RuleChip, { label: "Presupuesto", value: formatMoney(rules.budget) }), _jsx(RuleChip, { label: "Plantilla", value: `${rules.squadSize} jugadores`, hint: `POR ${rules.gkMin}-${rules.gkMax} · DEF ${rules.defMin}-${rules.defMax}` }), _jsx(RuleChip, { label: "OVR m\u00EDnimo", value: `${rules.minOvr}`, hint: `Máx. sub-21 · ${rules.maxU21}` }), _jsx(RuleChip, { label: "Cierre de alineaci\u00F3n", value: `${rules.lineupLockHours} h antes`, hint: "Se fija en cada jornada" })] })) : null, _jsxs("section", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx(Globe, { className: "absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/45", "aria-hidden": "true" }), _jsx(Input, { value: country, onChange: (e) => setCountry(e.target.value), placeholder: "Pa\u00EDs\u2026", "aria-label": "Filtrar por pa\u00EDs", className: "h-11 border-white/15 bg-white/10 pl-9 text-white placeholder:text-white/45" })] }), _jsxs("div", { className: "relative flex-1", children: [_jsx(Flag, { className: "absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/45", "aria-hidden": "true" }), _jsx(Input, { value: league, onChange: (e) => setLeague(e.target.value), placeholder: "Liga\u2026", "aria-label": "Filtrar por liga", className: "h-11 border-white/15 bg-white/10 pl-9 text-white placeholder:text-white/45" })] }), _jsxs("div", { className: "relative flex-1", children: [_jsx(Search, { className: "absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/45", "aria-hidden": "true" }), _jsx(Input, { value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Buscar equipo\u2026", "aria-label": "Buscar equipo", className: "h-11 border-white/15 bg-white/10 pl-9 text-white placeholder:text-white/45" })] })] }), _jsx("div", { className: "flex flex-wrap gap-2", children: leagueOptions.map((option) => (_jsx("button", { type: "button", onClick: () => setLeague(option), "aria-pressed": league === option, className: cn("min-h-11 rounded-lg border px-3 text-xs font-semibold transition-colors", league === option
                                        ? "border-brand-bright bg-brand/25 text-white"
                                        : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"), children: option }, option))) }), _jsx("ul", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3", children: visible.map((entry) => {
                                    const taken = entry.takenByMe || entry.takenByOther;
                                    return (_jsxs("li", { className: cn("flex flex-col gap-3 rounded-2xl border p-4 transition-colors", taken
                                            ? "border-white/10 bg-white/[0.03] opacity-70"
                                            : "border-white/12 bg-white/[0.06] hover:border-brand-bright/60"), children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Crest, { name: entry.name, shortName: entry.name.slice(0, 3).toUpperCase(), colors: entry.colors, size: "lg" }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "display truncate text-sm text-white", children: entry.name }), _jsxs("p", { className: "truncate text-[11px] text-white/60", children: [entry.league, " \u00B7 ", entry.country] })] })] }), _jsxs("dl", { className: "num grid grid-cols-2 gap-2 text-[11px] text-white/70", children: [_jsxs("div", { children: [_jsx("dt", { className: "uppercase tracking-wide text-white/45", children: "Presupuesto" }), _jsx("dd", { className: "text-sm font-semibold text-white", children: formatMoney(rules?.budget ?? 0) })] }), _jsxs("div", { children: [_jsx("dt", { className: "uppercase tracking-wide text-white/45", children: "Jugadores" }), _jsx("dd", { className: "text-sm font-semibold text-white", children: rules?.squadSize ?? "—" })] })] }), taken ? (_jsxs("p", { className: "inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/60", children: [_jsx(Info, { className: "size-3.5", "aria-hidden": "true" }), entry.takenByMe ? "Tu equipo seleccionado" : "Ya presidido por otro Presidente"] })) : (_jsxs("p", { className: "inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300", children: [_jsx(CheckCircle2, { className: "size-3.5", "aria-hidden": "true" }), "Disponible"] })), _jsx(Button, { type: "button", disabled: taken, onClick: () => setCandidate(buildClubView(entry)), className: "min-h-11", variant: taken ? "secondary" : "default", children: taken ? "No disponible" : "Seleccionar equipo" })] }, entry.id));
                                }) }), visible.length === 0 ? (_jsx("p", { className: "rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/70", children: healingCatalog
                                    ? "Cargando el catálogo global de equipos…"
                                    : "No hay equipos que coincidan con los filtros. Cambia de país, liga o término de búsqueda." })) : null] })] }), _jsx(Dialog, { open: Boolean(candidate), onOpenChange: (open) => !open && setCandidate(null), children: _jsx(DialogContent, { className: "sm:max-w-md", children: candidate ? (_jsxs(_Fragment, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { className: "display", children: "\u00BFQuieres representar este equipo?" }), _jsxs(DialogDescription, { children: ["Esta decisi\u00F3n te asigna la presidencia dentro de ", state.tournament?.name, "."] })] }), _jsxs("div", { className: "flex items-center gap-3 rounded-xl border bg-muted/40 p-3", children: [_jsx(Crest, { name: candidate.name, shortName: candidate.shortName, colors: [candidate.colorPrimary, candidate.colorSecondary], size: "xl" }), _jsxs("div", { children: [_jsx("p", { className: "display text-sm", children: candidate.name }), _jsxs("p", { className: "text-[11px] text-muted-foreground", children: [candidate.league, " \u00B7 ", candidate.country] })] })] }), _jsxs("dl", { className: "grid grid-cols-2 gap-3 text-sm", children: [_jsxs("div", { className: "rounded-lg border p-3", children: [_jsx("dt", { className: "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", children: "Presupuesto" }), _jsx("dd", { className: "num mt-0.5 font-bold", children: formatMoney(rules?.budget ?? 0) })] }), _jsxs("div", { className: "rounded-lg border p-3", children: [_jsx("dt", { className: "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", children: "Plantilla inicial" }), _jsxs("dd", { className: "num mt-0.5 font-bold", children: ["0 / ", rules?.squadSize ?? 0] })] })] }), _jsx("p", { className: "text-xs leading-relaxed text-muted-foreground", children: "Arrancas con la plantilla vac\u00EDa: construir\u00E1s tu equipo en el primer draft fichando del cat\u00E1logo FC 27 con este presupuesto. El motor de reglas validar\u00E1 cada ficha contra el reglamento de la liga (cupos por posici\u00F3n, OVR y sub-21)." }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", className: "min-h-11", onClick: () => setCandidate(null), disabled: saving, children: "Elegir otro" }), _jsx(Button, { type: "button", className: "min-h-11", onClick: confirm, disabled: saving, children: saving ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" }), "Confirmando\u2026"] })) : ("Confirmar equipo") })] })] })) : null }) })] }));
}
function RuleChip({ label, value, hint, }) {
    return (_jsxs("div", { className: "flex flex-col gap-0.5", children: [_jsx("span", { className: "text-[10px] font-bold uppercase tracking-[0.18em] text-white/45", children: label }), _jsx("span", { className: "num display text-base text-white", children: value }), hint ? _jsx("span", { className: "text-[11px] text-white/55", children: hint }) : null] }));
}
