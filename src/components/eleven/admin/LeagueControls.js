import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/lib/errors";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { SectionCard } from "@/components/eleven/SectionCard";
import { CompetitionPicker } from "@/components/eleven/CompetitionPicker";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fc27Competition } from "@/convex/fc27Catalog";
import { FieldLabel } from "@/components/eleven/admin/AdminBits";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Gamepad2, Loader2, RotateCcw, Save, } from "lucide-react";
/**
 * The league always mirrors ONE EA SPORTS FC 27 competition: the catalogue is
 * the single source of truth for creating and configuring tournaments so both
 * games stay in parity.
 */
export function CompetitionCard({ tournament }) {
    const setCompetition = useMutation(api.adminOps.setCompetition);
    const [draft, setDraft] = useState(tournament.competitionId ?? "");
    const [busy, setBusy] = useState(false);
    const selected = fc27Competition(tournament.competitionId);
    const dirty = draft !== "" && draft !== tournament.competitionId;
    const save = async () => {
        if (!draft)
            return;
        setBusy(true);
        try {
            const result = await setCompetition({ competitionId: draft });
            toast.success("Competición configurada", {
                description: `«${result.name}» · ${result.matchdays} jornadas. La liga replica esa competición de EA SPORTS FC 27.`,
            });
        }
        catch (cause) {
            toast.error("No se pudo cambiar la competición", {
                description: errorMessage(cause),
            });
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(SectionCard, { title: "Competici\u00F3n (paridad con EA SPORTS FC 27)", icon: Gamepad2, accent: "gold", bodyClassName: "flex flex-col gap-3", children: [_jsxs("p", { className: "max-w-3xl text-sm text-muted-foreground", children: ["El cat\u00E1logo de competiciones de ", _jsx("strong", { children: "EA SPORTS FC 27" }), " es la \u00FAnica referencia para crear y configurar torneos en 11Eleven: si una competici\u00F3n no existe en FC 27, no puede existir aqu\u00ED. Al elegirla se ajustan las jornadas al formato real."] }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end", children: [_jsx(CompetitionPicker, { id: "adminCompetition", value: draft || tournament.competitionId || "", onChange: setDraft, hint: "Solo competiciones oficiales de FC 27: ligas, copas e internacionales.", disabled: busy }), _jsxs(Button, { type: "button", className: "min-h-11", disabled: busy || !dirty, onClick: () => void save(), children: [busy ? (_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" })) : (_jsx(Save, { className: "size-4", "aria-hidden": "true" })), "Aplicar competici\u00F3n"] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs", children: [_jsxs(Badge, { variant: "outline", children: [tournament.totalMatchdays, " jornadas"] }), _jsx(Badge, { variant: "outline", children: tournament.season }), selected ? (_jsxs("span", { className: "text-muted-foreground", children: ["Configurada: ", _jsx("strong", { className: "text-foreground", children: selected.name }), " \u00B7", " ", selected.country] })) : (_jsx("span", { className: "text-amber-700 dark:text-amber-300", children: "Sin competici\u00F3n asignada todav\u00EDa (las ligas nuevas ya nacen con una)." }))] })] }));
}
/**
 * Danger zone: leave the league exactly as it was created — teams, budgets
 * and squads back to zero. Rules, prizes, members and the audit trail survive.
 */
export function ResetLeagueCard({ overview }) {
    const resetLeague = useMutation(api.adminOps.resetLeague);
    const [open, setOpen] = useState(false);
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const totals = overview.totals;
    const submit = async () => {
        setBusy(true);
        try {
            const result = await resetLeague({ confirmation: confirm });
            toast.success("Liga reiniciada desde cero", {
                description: `${result.counts.presidents} presidencias, ${result.counts.squads} plantillas y ${result.counts.fixtures} partidos borrados. Vuelve a la fase de selección de clubes.`,
            });
            setOpen(false);
            setConfirm("");
        }
        catch (cause) {
            toast.error("No se pudo reiniciar la liga", {
                description: errorMessage(cause),
            });
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs("section", { className: "card-soft flex flex-col gap-3 border-rose-500/30 p-4", children: [_jsxs("header", { className: "flex items-center gap-2", children: [_jsx("span", { "aria-hidden": "true", className: "h-4 w-1 rounded-full bg-rose-500" }), _jsxs("h3", { className: "display flex items-center gap-2 text-[13px] text-rose-700 dark:text-rose-300", children: [_jsx(RotateCcw, { className: "size-4", "aria-hidden": "true" }), "Reiniciar la liga desde cero"] })] }), _jsx("p", { className: "max-w-3xl text-xs leading-relaxed text-muted-foreground", children: "Borra los equipos seleccionados, los presupuestos asignados, las plantillas, las operaciones, el draft y el calendario para dejar la liga como el primer d\u00EDa. Se conservan las reglas, los premios configurados, los miembros, los administradores y la auditor\u00EDa." }), _jsxs("div", { className: "flex flex-wrap gap-2 text-[11px]", children: [_jsxs(Badge, { variant: "outline", children: [totals.squads, " plantillas"] }), _jsxs(Badge, { variant: "outline", children: [totals.players, " jugadores"] }), _jsxs(Badge, { variant: "outline", children: [overview.presidents.length, " presidencias"] }), _jsxs(Badge, { variant: "outline", children: [overview.clubs.length, " clubes"] })] }), _jsxs(Button, { type: "button", variant: "outline", className: "min-h-11 self-start border-rose-500/40 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300", onClick: () => setOpen(true), children: [_jsx(AlertTriangle, { className: "size-4", "aria-hidden": "true" }), "Reiniciar liga"] })] }), _jsx(AlertDialog, { open: open, onOpenChange: setOpen, children: _jsxs(AlertDialogContent, { className: "sm:max-w-lg", children: [_jsxs(AlertDialogHeader, { children: [_jsxs(AlertDialogTitle, { className: "display text-rose-700 dark:text-rose-300", children: ["\u00BFReiniciar \u00AB", overview.tournament?.name, "\u00BB desde cero?"] }), _jsx(AlertDialogDescription, { children: "Esta acci\u00F3n no se puede deshacer. Se eliminar\u00E1n:" })] }), _jsxs("ul", { className: "list-disc space-y-1 pl-5 text-xs text-muted-foreground", children: [_jsxs("li", { children: [overview.presidents.length, " presidencias y sus presupuestos."] }), _jsxs("li", { children: [totals.squads, " plantillas con ", totals.players, " jugadores (vuelven a agente libre)."] }), _jsx("li", { children: "Clubes seleccionados, operaciones de mercado, draft y calendario completo." }), _jsx("li", { children: "Resultados detallados registrados en los partidos." })] }), _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx(FieldLabel, { htmlFor: "resetConfirm", tip: 'Escribe REINICIAR en may\u00FAsculas para confirmar. Es la salvaguarda definitiva contra un clic accidental: la liga vuelve a la fase de selecci\u00F3n de clubes.', children: "Confirmaci\u00F3n" }), _jsx(Input, { id: "resetConfirm", className: "h-11", placeholder: "REINICIAR", value: confirm, onChange: (event) => setConfirm(event.target.value) }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: "Reglas y premios se mantienen tal como los configuraste." })] }), _jsxs(AlertDialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", className: "min-h-11", onClick: () => setOpen(false), children: "Cancelar" }), _jsxs(Button, { type: "button", className: "min-h-11 bg-rose-600 text-white hover:bg-rose-700", disabled: busy || confirm.trim().toUpperCase() !== "REINICIAR", onClick: () => void submit(), children: [busy ? (_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" })) : (_jsx(RotateCcw, { className: "size-4", "aria-hidden": "true" })), "Reiniciar la liga"] })] })] }) })] }));
}
