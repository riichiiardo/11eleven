import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/lib/errors";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompetitionPicker, DEFAULT_FC27_ID, } from "@/components/eleven/CompetitionPicker";
import { ArrowRight, CheckCircle2, Loader2, Plus, Swords } from "lucide-react";
/**
 * League manager reachable from the user menu: switch the active league,
 * start a brand-new one (a clean slate for testing without wiping the
 * database) or join an existing league with its invitation code.
 */
export function LeagueManagerDialog({ open, onOpenChange, leagues, }) {
    const navigate = useNavigate();
    const activateLeague = useMutation(api.leagues.activateLeague);
    const createLeague = useMutation(api.leagues.createLeague);
    const joinLeague = useMutation(api.leagues.joinLeague);
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [competitionId, setCompetitionId] = useState(DEFAULT_FC27_ID);
    const [busyKey, setBusyKey] = useState(null);
    const busy = busyKey !== null;
    const activate = async (tournamentId) => {
        setBusyKey(`activar-${tournamentId}`);
        try {
            const result = await activateLeague({ tournamentId });
            toast.success(`Liga activa: ${result.name}`, {
                description: "Todo el panel ya apunta a esa liga.",
            });
            onOpenChange(false);
            navigate("/dashboard");
        }
        catch (cause) {
            toast.error("No se pudo cambiar de liga", {
                description: errorMessage(cause),
            });
        }
        finally {
            setBusyKey(null);
        }
    };
    const create = async (event) => {
        event.preventDefault();
        setBusyKey("crear");
        try {
            const result = await createLeague({ name, competitionId });
            toast.success(`Liga ${result.name} creada`, {
                description: "Eres el Administrador principal. Siguiente paso: configura las reglas de tu liga.",
            });
            setName("");
            onOpenChange(false);
            navigate("/dashboard/admin");
        }
        catch (cause) {
            toast.error("No se pudo crear la liga", {
                description: errorMessage(cause),
            });
        }
        finally {
            setBusyKey(null);
        }
    };
    const join = async (event) => {
        event.preventDefault();
        setBusyKey("unirse");
        try {
            const result = await joinLeague({ code });
            toast.success(`Te uniste a ${result.name}`, {
                description: "Ahora elige el equipo que vas a presidir.",
            });
            setCode("");
            onOpenChange(false);
            navigate("/dashboard");
        }
        catch (cause) {
            toast.error("No se pudo unir a la liga", {
                description: errorMessage(cause),
            });
        }
        finally {
            setBusyKey(null);
        }
    };
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-h-[85vh] overflow-y-auto sm:max-w-lg", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { className: "display", children: "Mis ligas" }), _jsx(DialogDescription, { children: "Cambia de liga, crea una nueva para empezar una prueba limpia o \u00FAnete a otra con su c\u00F3digo. Tus ligas anteriores conservan sus datos: nada se borra." })] }), _jsxs("section", { className: "flex flex-col gap-2", children: [_jsx("h3", { className: "text-xs font-bold uppercase tracking-wide text-muted-foreground", children: "Tus ligas" }), leagues.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "Todav\u00EDa no perteneces a ninguna liga." })) : (_jsx("ul", { className: "divide-y", children: leagues.map((league) => (_jsxs("li", { className: "flex flex-wrap items-center justify-between gap-3 py-2.5", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-sm font-semibold", children: league.name }), _jsxs("p", { className: "truncate text-[11px] text-muted-foreground", children: [league.season, " \u00B7 ", league.memberCount, " miembro(s) \u00B7", " ", league.myClubName
                                                        ? `Presides ${league.myClubName}`
                                                        : "Sin equipo todavía"] })] }), league.active ? (_jsxs(Badge, { variant: "outline", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", children: [_jsx(CheckCircle2, { className: "size-3", "aria-hidden": "true" }), "Activa"] })) : (_jsxs(Button, { type: "button", variant: "outline", size: "sm", className: "min-h-9 shrink-0", disabled: busy, onClick: () => void activate(league.id), children: [busyKey === `activar-${league.id}` ? (_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" })) : null, "Activar"] }))] }, league.id))) }))] }), _jsxs("form", { onSubmit: create, className: "flex flex-col gap-2", children: [_jsx(Label, { htmlFor: "newLeagueName", className: "text-xs", children: "Crear una liga nueva (prueba limpia)" }), _jsx(CompetitionPicker, { id: "newLeagueCompetition", value: competitionId, onChange: setCompetitionId, disabled: busy, hint: "La liga replica una competici\u00F3n oficial de EA SPORTS FC 27 (paridad con el juego)." }), _jsxs("div", { className: "flex flex-col gap-2 sm:flex-row", children: [_jsx(Input, { id: "newLeagueName", value: name, onChange: (event) => setName(event.target.value), placeholder: "Ej. Liga de Pruebas 2026", className: "h-11", required: true, minLength: 3, maxLength: 60 }), _jsxs(Button, { type: "submit", className: "min-h-11 shrink-0", disabled: busy || name.trim().length < 3, children: [busyKey === "crear" ? (_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" })) : (_jsx(Plus, { className: "size-4", "aria-hidden": "true" })), "Crear y configurar reglas"] })] }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: "Se crea con datos en cero y quedas como Administrador principal: directo al paso de reglas." })] }), _jsxs("form", { onSubmit: join, className: "flex flex-col gap-2", children: [_jsx(Label, { htmlFor: "joinLeagueCode", className: "text-xs", children: "Unirme a una liga con c\u00F3digo" }), _jsxs("div", { className: "flex flex-col gap-2 sm:flex-row", children: [_jsx(Input, { id: "joinLeagueCode", value: code, onChange: (event) => setCode(event.target.value.toUpperCase()), placeholder: "Ej. LIGCOL-K7QX", className: "num h-11", required: true, minLength: 4 }), _jsxs(Button, { type: "submit", variant: "outline", className: "min-h-11 shrink-0", disabled: busy || code.trim().length < 4, children: [busyKey === "unirse" ? (_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" })) : (_jsx(Swords, { className: "size-4", "aria-hidden": "true" })), "Unirme"] })] }), _jsxs("p", { className: "text-[11px] text-muted-foreground", children: ["Al entrar, la liga pasa a ser tu liga activa y eliges tu equipo del cat\u00E1logo mundial.", _jsx(ArrowRight, { className: "ml-1 inline size-3", "aria-hidden": "true" })] })] })] }) }));
}
