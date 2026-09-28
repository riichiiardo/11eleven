import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/lib/errors";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { BrandLockup } from "@/components/eleven/Brand";
import { Crest } from "@/components/eleven/Crest";
import { CompetitionPicker, DEFAULT_FC27_ID, } from "@/components/eleven/CompetitionPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, CheckCircle2, Copy, Loader2, Plus, Swords, Trophy, Users, } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The create/join gate. A user without a league sees ONLY this screen: create
 * a league (walks into the rules step) or join one with its invitation code.
 * Existing memberships can be re-activated from here too.
 */
export default function LeagueGate({ state }) {
    const navigate = useNavigate();
    const createLeague = useMutation(api.leagues.createLeague);
    const joinLeague = useMutation(api.leagues.joinLeague);
    const activateLeague = useMutation(api.leagues.activateLeague);
    const [mode, setMode] = useState(state.leagues.length > 0 ? "unirse" : "crear");
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [competitionId, setCompetitionId] = useState(DEFAULT_FC27_ID);
    const [busy, setBusy] = useState(false);
    const create = async (event) => {
        event.preventDefault();
        setBusy(true);
        try {
            const result = await createLeague({ name, competitionId });
            toast.success(`Liga ${result.name} creada`, {
                description: "Eres el Administrador principal. Siguiente paso: configura las reglas de tu liga.",
            });
            navigate("/dashboard/admin");
        }
        catch (cause) {
            toast.error("No se pudo crear la liga", {
                description: errorMessage(cause),
            });
        }
        finally {
            setBusy(false);
        }
    };
    const join = async (event) => {
        event.preventDefault();
        setBusy(true);
        try {
            const result = await joinLeague({ code });
            toast.success(`Te uniste a ${result.name}`, {
                description: "Ahora elige el equipo que vas a presidir.",
            });
        }
        catch (cause) {
            toast.error("No se pudo unir a la liga", {
                description: errorMessage(cause),
            });
        }
        finally {
            setBusy(false);
        }
    };
    const activate = async (tournamentId) => {
        setBusy(true);
        try {
            const result = await activateLeague({
                tournamentId: tournamentId,
            });
            toast.success(`Liga activa: ${result.name}`);
        }
        catch (cause) {
            toast.error("No se pudo cambiar de liga", {
                description: errorMessage(cause),
            });
        }
        finally {
            setBusy(false);
        }
    };
    const copyCode = async (code) => {
        try {
            await navigator.clipboard.writeText(code);
            toast.info(`Código ${code} copiado`, {
                description: "Compártelo para que otros Presidentes se unan.",
            });
        }
        catch {
            toast.info(`Código de invitación: ${code}`);
        }
    };
    return (_jsx("div", { className: "rail-surface min-h-screen px-4 py-8 text-white sm:px-6 lg:py-14", children: _jsxs("div", { className: "mx-auto flex w-full max-w-5xl flex-col gap-8", children: [_jsxs("header", { className: "flex flex-col items-center gap-3 text-center", children: [_jsx(BrandLockup, {}), _jsxs("h1", { className: "display mt-4 text-3xl leading-tight sm:text-4xl", children: ["Bienvenido, ", state.user.name] }), _jsxs("p", { className: "max-w-2xl text-sm text-white/70", children: ["              En 11Eleven eres el ", _jsx("strong", { className: "text-white", children: "Presidente" }), " ", "de tu propio club de fantas\u00EDa con acceso a m\u00E1s de 100 equipos de las principales ligas del mundo. Crea tu liga y configura sus reglas, o \u00FAnete a la de un amigo con su c\u00F3digo de invitaci\u00F3n."] })] }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("button", { type: "button", onClick: () => setMode("crear"), "aria-pressed": mode === "crear", className: cn("flex flex-col gap-2 rounded-2xl border p-5 text-left transition-colors", mode === "crear"
                                ? "border-brand-bright bg-brand/20"
                                : "border-white/12 bg-white/[0.05] hover:bg-white/10"), children: [_jsx("span", { className: "flex size-10 items-center justify-center rounded-xl bg-gold/20", children: _jsx(Plus, { className: "size-5 text-amber-300", "aria-hidden": "true" }) }), _jsx("span", { className: "display text-lg", children: "Crear mi liga" }), _jsx("span", { className: "text-xs leading-relaxed text-white/65", children: "T\u00FA eres el Administrador principal: defines presupuesto, tama\u00F1o de plantilla, cupos, draft y calendario. Invitas a quien quieras con tu c\u00F3digo." })] }), _jsxs("button", { type: "button", onClick: () => setMode("unirse"), "aria-pressed": mode === "unirse", className: cn("flex flex-col gap-2 rounded-2xl border p-5 text-left transition-colors", mode === "unirse"
                                ? "border-brand-bright bg-brand/20"
                                : "border-white/12 bg-white/[0.05] hover:bg-white/10"), children: [_jsx("span", { className: "flex size-10 items-center justify-center rounded-xl bg-brand/25", children: _jsx(Users, { className: "size-5 text-sky-300", "aria-hidden": "true" }) }), _jsx("span", { className: "display text-lg", children: "Unirme a una liga" }), _jsx("span", { className: "text-xs leading-relaxed text-white/65", children: "Tienes un c\u00F3digo de invitaci\u00F3n? Entra a una liga existente, elige entre m\u00E1s de 100 equipos de las principales ligas del mundo y compite en el draft." })] })] }), mode === "crear" ? (_jsxs("form", { onSubmit: create, className: "flex flex-col gap-4 rounded-2xl border border-white/12 bg-white/[0.05] p-5", children: [_jsx(CompetitionPicker, { id: "leagueCompetition", value: competitionId, onChange: setCompetitionId, dark: true, disabled: busy, hint: "Cada liga replica una competici\u00F3n real de EA SPORTS FC 27: as\u00ED el juego y 11ELEVEN siempre coinciden." }), _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx(Label, { htmlFor: "leagueName", className: "text-xs text-white/80", children: "Nombre de tu liga" }), _jsx(Input, { id: "leagueName", value: name, onChange: (event) => setName(event.target.value), placeholder: "Ej. Liga Colombiana Fantasy 2026", className: "h-11 border-white/15 bg-white/10 text-white placeholder:text-white/40", required: true, minLength: 3, maxLength: 60 }), _jsx("p", { className: "text-[11px] text-white/50", children: "Despu\u00E9s de crearla te llevamos directo a configurar sus reglas: presupuesto, plantilla, cupos por posici\u00F3n y draft." })] }), _jsx(Button, { type: "submit", className: "min-h-11 self-start", disabled: busy || name.trim().length < 3, children: busy ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" }), "Creando\u2026"] })) : (_jsxs(_Fragment, { children: [_jsx(Trophy, { className: "size-4", "aria-hidden": "true" }), "Crear liga y configurar reglas", _jsx(ArrowRight, { className: "size-4", "aria-hidden": "true" })] })) })] })) : (_jsxs("form", { onSubmit: join, className: "flex flex-col gap-4 rounded-2xl border border-white/12 bg-white/[0.05] p-5", children: [_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx(Label, { htmlFor: "leagueCode", className: "text-xs text-white/80", children: "C\u00F3digo de invitaci\u00F3n" }), _jsx(Input, { id: "leagueCode", value: code, onChange: (event) => setCode(event.target.value.toUpperCase()), placeholder: "Ej. LIGCOL-K7QX", className: "num h-11 border-white/15 bg-white/10 text-white placeholder:text-white/40", required: true, minLength: 4 }), _jsx("p", { className: "text-[11px] text-white/50", children: "El Administrador de la liga comparte este c\u00F3digo. Al entrar eliges un equipo libre del cat\u00E1logo mundial." })] }), _jsx(Button, { type: "submit", className: "min-h-11 self-start", disabled: busy || code.trim().length < 4, children: busy ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" }), "Entrando\u2026"] })) : (_jsxs(_Fragment, { children: [_jsx(Swords, { className: "size-4", "aria-hidden": "true" }), "Unirme a la liga"] })) })] })), state.leagues.length > 0 ? (_jsxs("section", { className: "flex flex-col gap-3", children: [_jsx("h2", { className: "display text-sm uppercase tracking-[0.18em] text-white/60", children: "Tus ligas" }), _jsx("ul", { className: "grid gap-3 sm:grid-cols-2", children: state.leagues.map((league) => (_jsxs("li", { className: cn("flex flex-col gap-3 rounded-2xl border p-4", league.active
                                    ? "border-brand-bright/60 bg-brand/15"
                                    : "border-white/12 bg-white/[0.04]"), children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "display truncate text-sm", children: league.name }), _jsxs("p", { className: "truncate text-[11px] text-white/55", children: [league.season, " \u00B7 ", league.memberCount, " miembro(s)"] })] }), league.active ? (_jsxs(Badge, { className: "shrink-0 border-0 bg-emerald-500/20 text-emerald-200", children: [_jsx(CheckCircle2, { className: "size-3", "aria-hidden": "true" }), "Activa"] })) : null] }), league.myClubName ? (_jsxs("div", { className: "flex items-center gap-2 text-[11px] text-white/70", children: [_jsx(Crest, { name: league.myClubName, shortName: league.myClubName.slice(0, 3).toUpperCase(), colors: ["#1d4ed8", "#0b1a30"], size: "sm" }), "Presides ", league.myClubName] })) : (_jsx("p", { className: "text-[11px] text-white/55", children: "Sin equipo todav\u00EDa: elige uno del cat\u00E1logo al entrar." })), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("button", { type: "button", onClick: () => copyCode(league.code), className: "num inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/10", title: "Copiar c\u00F3digo de invitaci\u00F3n", children: [league.code, _jsx(Copy, { className: "size-3", "aria-hidden": "true" })] }), league.isAdmin ? (_jsx(Badge, { variant: "outline", className: "border-gold/40 bg-gold/10 text-[10px] text-amber-200", children: "Administrador" })) : null, !league.active ? (_jsx(Button, { type: "button", size: "sm", className: "min-h-9", disabled: busy, onClick: () => activate(league.id), children: "Entrar" })) : null] })] }, league.id))) })] })) : null] }) }));
}
