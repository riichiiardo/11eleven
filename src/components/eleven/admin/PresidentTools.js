import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { formatMoney } from "@/convex/rulesEngine";
import { errorMessage } from "@/lib/errors";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { FieldLabel, Tip } from "@/components/eleven/admin/AdminBits";
import { Copy, Link2, Loader2, RefreshCw, Share2, Trash2, UserRoundCog, Wallet, } from "lucide-react";
/* ------------------------------------------------------------------ *
 * Shareable invitation link (not only by e-mail)
 * ------------------------------------------------------------------ */
export function InviteCard({ code }) {
    const inviteUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/dashboard?invitar=${code}`;
    const copy = async (value, label) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(`${label} copiado`, {
                description: "Compártelo con los posibles Presidentes de tu liga.",
            });
        }
        catch {
            toast.info(`${label}: ${value}`);
        }
    };
    const share = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: "Únete a mi liga en 11Eleven",
                    text: `Entra a mi liga de fantasía con el código ${code}`,
                    url: inviteUrl,
                });
                return;
            }
            catch {
                /* user cancelled or unsupported: fall back to copy */
            }
        }
        await copy(inviteUrl, "Link de invitación");
    };
    return (_jsxs("section", { className: "card-soft flex flex-col gap-3 p-4", children: [_jsxs("header", { className: "flex items-center gap-2", children: [_jsx("span", { "aria-hidden": "true", className: "h-4 w-1 rounded-full bg-brand" }), _jsxs("h3", { className: "display flex items-center gap-2 text-[13px]", children: [_jsx(Share2, { className: "size-4 text-muted-foreground", "aria-hidden": "true" }), "Invitar Presidentes con un link"] }), _jsx(Tip, { side: "left", text: "Link compartible: cualquiera que lo abra entra directo a la pantalla de uni\u00F3n de tu liga (pide iniciar sesi\u00F3n si a\u00FAn no lo hizo). Sirve para WhatsApp, redes o donde quieras; el correo de Administraci\u00F3n sigue siendo otra v\u00EDa, para invitar Co-Administradores." })] }), _jsxs("p", { className: "text-xs leading-relaxed text-muted-foreground", children: ["Comparte este link en lugar del solo correo: quien lo abra se une a", " ", _jsx("strong", { className: "text-foreground", children: code }), " autom\u00E1ticamente y despu\u00E9s elige su equipo."] }), _jsxs("div", { className: "flex flex-col gap-2 sm:flex-row", children: [_jsx("input", { readOnly: true, "aria-label": "Link de invitaci\u00F3n", value: inviteUrl, onFocus: (event) => event.currentTarget.select(), className: "num h-11 min-w-0 flex-1 rounded-lg border bg-muted/40 px-3 text-xs" }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { type: "button", className: "min-h-11 shrink-0", onClick: () => void share(), children: [_jsx(Link2, { className: "size-4", "aria-hidden": "true" }), "Compartir link"] }), _jsxs(Button, { type: "button", variant: "outline", className: "min-h-11 shrink-0", onClick: () => void copy(inviteUrl, "Link de invitación"), children: [_jsx(Copy, { className: "size-4", "aria-hidden": "true" }), "Copiar"] })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs", children: [_jsx("span", { className: "text-muted-foreground", children: "C\u00F3digo corto:" }), _jsx(Badge, { variant: "outline", className: "num", children: code }), _jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: "min-h-8", onClick: () => void copy(code, "Código"), children: [_jsx(Copy, { className: "size-3.5", "aria-hidden": "true" }), "Copiar c\u00F3digo"] })] })] }));
}
/* ------------------------------------------------------------------ *
 * Change a president's club (from the available pool)
 * ------------------------------------------------------------------ */
export function ChangeClubDialog({ president, teams, }) {
    const changeClub = useMutation(api.adminOps.changePresidentClub);
    const [open, setOpen] = useState(false);
    const [target, setTarget] = useState("");
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        if (!target)
            return;
        setBusy(true);
        try {
            const [kind, id] = target.split(":");
            const result = await changeClub({
                presidentId: president.id,
                ...(kind === "lc" ? { leagueClubId: id } : { catalogTeamId: id }),
            });
            toast.success("Club cambiado", {
                description: `${president.displayName} ahora preside ${result.clubName}.`,
            });
            setOpen(false);
            setTarget("");
        }
        catch (cause) {
            toast.error("No se pudo cambiar el club", { description: errorMessage(cause) });
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs(Button, { type: "button", variant: "outline", size: "sm", className: "min-h-9", onClick: () => setOpen(true), children: [_jsx(RefreshCw, { className: "size-3.5", "aria-hidden": "true" }), "Cambiar equipo"] }), _jsx(Dialog, { open: open, onOpenChange: setOpen, children: _jsxs(DialogContent, { className: "sm:max-w-lg", children: [_jsxs(DialogHeader, { children: [_jsxs(DialogTitle, { className: "display flex items-center gap-2", children: [_jsx(UserRoundCog, { className: "size-4", "aria-hidden": "true" }), "Cambiar equipo de ", president.displayName] }), _jsx(DialogDescription, { children: "Mueve la presidencia a cualquier equipo disponible del pool. La plantilla, el presupuesto y el historial del Presidente se conservan; si el destino ya juega en el calendario, el club anterior queda libre." })] }), _jsxs("div", { className: "flex flex-col gap-3", children: [_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx(FieldLabel, { htmlFor: "changeClubTarget", tip: "Pool de equipos: clubes de la liga sin Presidente (ya est\u00E1n en el calendario) y equipos del cat\u00E1logo mundial que a\u00FAn no ha elegido nadie. Los ocupados no aparecen.", children: "Equipo disponible" }), _jsxs(Select, { value: target, onValueChange: setTarget, disabled: teams.length === 0, children: [_jsx(SelectTrigger, { id: "changeClubTarget", className: "min-h-11", children: _jsx(SelectValue, { placeholder: "Elige un equipo libre" }) }), _jsx(SelectContent, { className: "max-h-80", children: teams.map((team) => (_jsxs(SelectItem, { value: team.leagueClubId ? `lc:${team.leagueClubId}` : `ct:${team.catalogTeamId}`, className: "min-h-10", children: [team.name, _jsxs("span", { className: "text-muted-foreground", children: [" ", "\u00B7 ", team.league, team.leagueClubId ? " · libre en la liga" : ""] })] }, team.leagueClubId ? `lc:${team.leagueClubId}` : `ct:${team.catalogTeamId}`))) })] }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: teams.length > 0
                                                ? `${teams.length} equipo(s) disponible(s) ahora mismo.`
                                                : "No hay equipos libres: elimina una presidencia o amplía el catálogo." })] }), _jsx("div", { className: "rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground", children: _jsxs("p", { children: ["Actual: ", _jsx("strong", { className: "text-foreground", children: president.clubName }), " \u00B7", " ", president.squadSize, " jugador(es) en plantilla \u00B7", " ", formatMoney(president.budget), " de presupuesto."] }) }), _jsxs(Button, { type: "button", className: "min-h-11 self-start", disabled: !target || busy, onClick: () => void submit(), children: [busy ? (_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" })) : (_jsx(RefreshCw, { className: "size-4", "aria-hidden": "true" })), "Asignar este equipo"] })] })] }) })] }));
}
/* ------------------------------------------------------------------ *
 * Extra budget for official extra events
 * ------------------------------------------------------------------ */
export function GrantBudgetDialog({ president }) {
    const grantBudget = useMutation(api.adminOps.grantBudget);
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState(1);
    const [concept, setConcept] = useState("");
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        setBusy(true);
        try {
            const result = await grantBudget({
                presidentId: president.id,
                amount: Math.round(amount * 1000000),
                concept,
            });
            toast.success("Presupuesto extra asignado", {
                description: `${president.displayName}: +${formatMoney(result.granted)} · nuevo presupuesto ${formatMoney(result.budget)}.`,
            });
            setOpen(false);
            setConcept("");
        }
        catch (cause) {
            toast.error("No se pudo asignar el presupuesto", {
                description: errorMessage(cause),
            });
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs(Button, { type: "button", variant: "outline", size: "sm", className: "min-h-9", onClick: () => setOpen(true), children: [_jsx(Wallet, { className: "size-3.5", "aria-hidden": "true" }), "Presupuesto extra"] }), _jsx(Dialog, { open: open, onOpenChange: setOpen, children: _jsxs(DialogContent, { className: "sm:max-w-lg", children: [_jsxs(DialogHeader, { children: [_jsxs(DialogTitle, { className: "display flex items-center gap-2", children: [_jsx(Wallet, { className: "size-4", "aria-hidden": "true" }), "Presupuesto extra para ", president.displayName] }), _jsx(DialogDescription, { children: "Se suma a la asignaci\u00F3n principal del Presidente y queda registrado en la auditor\u00EDa con el evento oficial que lo motiva." })] }), _jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx(FieldLabel, { htmlFor: "grantAmount", tip: "Cantidad en millones de euros que se sumar\u00E1 al presupuesto actual. Ej.: 2 = 2.000.000 \u20AC. Debe ser un importe positivo.", children: "Importe (millones \u20AC)" }), _jsx(Input, { id: "grantAmount", type: "number", min: 0.1, step: 0.5, className: "h-11", value: amount, onChange: (event) => setAmount(Math.max(0, Number(event.target.value) || 0)) }), _jsxs("p", { className: "text-[11px] text-muted-foreground", children: ["Actual: ", formatMoney(president.budget), president.budgetExtra > 0
                                                            ? ` (incluye ${formatMoney(president.budgetExtra)} extra ya concedidos)`
                                                            : ""] })] }), _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx(FieldLabel, { htmlFor: "grantConcept", tip: "Motivo oficial del extra (evento, bonificaci\u00F3n, sanci\u00F3n compensada\u2026). Es obligatorio porque queda en la auditor\u00EDa y lo ven los Presidentes en su historial.", children: "Evento oficial que lo motiva" }), _jsx(Input, { id: "grantConcept", className: "h-11", maxLength: 140, placeholder: "Ej. Premio por campeonato de copa oficial", value: concept, onChange: (event) => setConcept(event.target.value), required: true })] })] }), _jsxs(Button, { type: "button", className: "min-h-11 self-start", disabled: busy || amount <= 0 || concept.trim().length < 3, onClick: () => void submit(), children: [busy ? (_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" })) : (_jsx(Wallet, { className: "size-4", "aria-hidden": "true" })), "Asignar ", formatMoney(Math.round(amount * 1000000))] })] })] }) })] }));
}
/* ------------------------------------------------------------------ *
 * Remove a president from the league
 * ------------------------------------------------------------------ */
export function RemovePresidentDialog({ president }) {
    const removePresident = useMutation(api.adminOps.removePresident);
    const [open, setOpen] = useState(false);
    const [confirm, setConfirm] = useState("");
    const [acknowledged, setAcknowledged] = useState(false);
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        setBusy(true);
        try {
            await removePresident({ presidentId: president.id });
            toast.success("Presidente eliminado", {
                description: `${president.displayName} ya no forma parte de la liga${president.clubName ? ` · ${president.clubName} queda disponible` : ""}.`,
            });
            setOpen(false);
            setConfirm("");
            setAcknowledged(false);
        }
        catch (cause) {
            toast.error("No se pudo eliminar al Presidente", {
                description: errorMessage(cause),
            });
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs(Button, { type: "button", variant: "outline", size: "sm", className: "min-h-9 border-rose-500/40 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300", onClick: () => setOpen(true), children: [_jsx(Trash2, { className: "size-3.5", "aria-hidden": "true" }), "Eliminar"] }), _jsx(Dialog, { open: open, onOpenChange: setOpen, children: _jsxs(DialogContent, { className: "sm:max-w-lg", children: [_jsxs(DialogHeader, { children: [_jsxs(DialogTitle, { className: "display text-rose-700 dark:text-rose-300", children: ["Eliminar a ", president.displayName, " de la liga"] }), _jsx(DialogDescription, { children: "Se retira la presidencia, su plantilla y su presupuesto. Si el club todav\u00EDa no tiene partidos programados, el equipo vuelve al pool; si ya juega en el calendario, queda libre en la liga." })] }), _jsxs("ul", { className: "list-disc space-y-1 pl-5 text-xs text-muted-foreground", children: [_jsxs("li", { children: ["Plantilla de ", president.squadSize, " jugador(es) y ", formatMoney(president.budget), " de presupuesto se liberan."] }), _jsx("li", { children: "Deja de ser miembro de la liga (si tambi\u00E9n administra, conserva ese rol)." }), _jsx("li", { children: "La acci\u00F3n queda en la auditor\u00EDa con tu nombre." })] }), _jsxs("label", { className: "flex items-start gap-2 rounded-lg border border-amber-500/35 bg-amber-500/[0.07] p-3 text-xs", children: [_jsx(Checkbox, { checked: acknowledged, onCheckedChange: (value) => setAcknowledged(value === true) }), _jsxs("span", { children: ["Entiendo que esta acci\u00F3n libera la presidencia de", " ", _jsx("strong", { children: president.clubName }), " y que sus jugadores quedan sin club."] })] }), _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx(FieldLabel, { htmlFor: "removeConfirm", tip: `Escribe ELIMINAR en mayúsculas para confirmar. Es una doble salvaguarda contra clics accidentales.`, children: "Confirmaci\u00F3n" }), _jsx(Input, { id: "removeConfirm", className: "h-11", placeholder: "ELIMINAR", value: confirm, onChange: (event) => setConfirm(event.target.value) })] }), _jsxs(Button, { type: "button", className: "min-h-11 self-start border border-rose-500/40 bg-rose-600 text-white hover:bg-rose-700", disabled: busy || !acknowledged || confirm.trim().toUpperCase() !== "ELIMINAR", onClick: () => void submit(), children: [busy ? (_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" })) : (_jsx(Trash2, { className: "size-4", "aria-hidden": "true" })), "Eliminar Presidente"] })] }) })] }));
}
