import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { RULE_DESCRIPTORS, TOURNAMENT_STATUSES, TOURNAMENT_STATUS_META, formatMoney, } from "@/convex/rulesEngine";
import { errorMessage, relativeTime } from "@/lib/errors";
import { useNow } from "@/hooks/use-tournament";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { useNavigate, useOutletContext } from "react-router";
import { SectionCard } from "@/components/eleven/SectionCard";
import { Countdown } from "@/components/eleven/SectionCard";
import { Crest } from "@/components/eleven/Crest";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { AlertTriangle, Crown, Database, Gauge, Handshake, Hourglass, Loader2, PauseCircle, PlayCircle, ScrollText, ShieldCheck, SkipForward, StopCircle, UserPlus, Users, Zap, } from "lucide-react";
import { useMarketActions } from "@/hooks/use-market-actions";
import { useDraftActions } from "@/hooks/use-draft-actions";
import { useCompetitionActions } from "@/hooks/use-competition-actions";
import { OfferCard } from "@/components/eleven/OfferCard";
import { OfferStatusPill } from "@/components/eleven/OfferBits";
import { TurnStrip, DraftStatusPill } from "@/components/eleven/DraftBits";
import { MatchCard, StandingsTable } from "@/components/eleven/MatchBits";
import { Award, RefreshCw, Swords, Trophy, } from "lucide-react";
import { FieldLabel, Tip } from "@/components/eleven/admin/AdminBits";
import { PrizesPanel } from "@/components/eleven/admin/PrizesPanel";
import { CatalogPanel } from "@/components/eleven/admin/CatalogPanel";
import { ChangeClubDialog, GrantBudgetDialog, InviteCard, RemovePresidentDialog, } from "@/components/eleven/admin/PresidentTools";
import { ResultReportButton } from "@/components/eleven/admin/ResultReportDialog";
import { CompetitionCard, ResetLeagueCard, } from "@/components/eleven/admin/LeagueControls";
const PERMISSION_LABELS = {
    configuracion: "Configuración",
    presidentes: "Presidentes",
    jugadores: "Jugadores",
    mercado: "Mercado",
    draft: "Draft",
    calendario: "Calendario",
    noticias: "Noticias",
    ia: "IA / publicaciones",
    auditoria: "Auditoría",
};
export default function Admin() {
    const state = useOutletContext();
    const navigate = useNavigate();
    const overview = useQuery(api.tournament.adminOverview);
    if (!state.isAdmin) {
        return (_jsxs("div", { className: "mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-3 text-center", children: [_jsx(ShieldCheck, { "aria-hidden": "true", className: "size-8 text-muted-foreground" }), _jsx("h1", { className: "display text-xl", children: "Solo para Administradores" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Administrar el torneo es un rol, no una cuenta distinta. Si necesitas acceso, pide al Administrador principal que asigne tu correo con los permisos correspondientes." }), _jsx(Button, { onClick: () => navigate("/dashboard"), className: "min-h-11", children: "Volver al inicio" })] }));
    }
    if (overview === undefined) {
        return (_jsxs("div", { className: "flex min-h-[50vh] items-center justify-center text-muted-foreground", children: [_jsx(Loader2, { className: "size-5 animate-spin", "aria-hidden": "true" }), _jsx("span", { className: "sr-only", children: "Cargando administraci\u00F3n" })] }));
    }
    if (overview === null || !overview.tournament || !overview.rules) {
        return (_jsx("p", { className: "p-6 text-sm text-muted-foreground", children: "No se pudo cargar la informaci\u00F3n administrativa del torneo." }));
    }
    return (_jsxs("div", { className: "mx-auto flex w-full max-w-[1400px] flex-col gap-5", children: [_jsxs("header", { className: "flex flex-col gap-2", children: [_jsx("h1", { className: "display text-2xl", children: "Administraci\u00F3n del torneo" }), _jsx("p", { className: "max-w-3xl text-sm text-muted-foreground", children: "Control de reglas, presidentes y trazabilidad. Cada cambio que hagas aqu\u00ED se aplica de inmediato al motor de reglas y queda registrado con tu nombre en la auditor\u00EDa." }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs(Badge, { variant: "outline", className: "border-gold/40 bg-gold/15 text-amber-700 dark:text-amber-300", children: [_jsx(Crown, { className: "size-3", "aria-hidden": "true" }), state.adminRole === "principal" ? "Administrador principal" : "Co-Administrador"] }), _jsxs(Badge, { variant: "outline", children: [overview.tournament.name, " \u00B7 ", overview.tournament.season] })] })] }), _jsxs(Tabs, { defaultValue: "torneo", className: "flex flex-col gap-4", children: [_jsxs(TabsList, { className: "self-start", children: [_jsxs(TabsTrigger, { value: "torneo", className: "min-h-10", children: [_jsx(Gauge, { className: "size-4", "aria-hidden": "true" }), "Torneo"] }), _jsxs(TabsTrigger, { value: "reglas", className: "min-h-10", children: [_jsx(ScrollText, { className: "size-4", "aria-hidden": "true" }), "Reglas"] }), _jsxs(TabsTrigger, { value: "premios", className: "min-h-10", children: [_jsx(Award, { className: "size-4", "aria-hidden": "true" }), "Premios"] }), _jsxs(TabsTrigger, { value: "presidentes", className: "min-h-10", children: [_jsx(Users, { className: "size-4", "aria-hidden": "true" }), "Presidentes"] }), _jsxs(TabsTrigger, { value: "mercado", className: "min-h-10", children: [_jsx(Handshake, { className: "size-4", "aria-hidden": "true" }), "Mercado"] }), _jsxs(TabsTrigger, { value: "draft", className: "min-h-10", children: [_jsx(Zap, { className: "size-4", "aria-hidden": "true" }), "Draft"] }), _jsxs(TabsTrigger, { value: "jornadas", className: "min-h-10", children: [_jsx(Swords, { className: "size-4", "aria-hidden": "true" }), "Jornadas"] }), _jsxs(TabsTrigger, { value: "auditoria", className: "min-h-10", children: [_jsx(ScrollText, { className: "size-4", "aria-hidden": "true" }), "Auditor\u00EDa"] }), _jsxs(TabsTrigger, { value: "catalogo", className: "min-h-10", children: [_jsx(Database, { className: "size-4", "aria-hidden": "true" }), "Cat\u00E1logo"] })] }), _jsxs(TabsContent, { value: "torneo", className: "flex flex-col gap-5", children: [_jsx(TournamentPanel, { overview: overview }), overview.tournament ? _jsx(CompetitionCard, { tournament: overview.tournament }) : null, _jsx(ResetLeagueCard, { overview: overview })] }), _jsx(TabsContent, { value: "reglas", className: "flex flex-col gap-5", children: _jsx(RulesPanel, { rules: overview.rules, presidents: overview.presidents, clubCount: overview.clubs.length }) }), _jsx(TabsContent, { value: "premios", className: "flex flex-col gap-5", children: _jsx(PrizesPanel, { overview: overview }) }), _jsx(TabsContent, { value: "presidentes", className: "flex flex-col gap-5", children: _jsx(PresidentsPanel, { overview: overview }) }), _jsx(TabsContent, { value: "mercado", className: "flex flex-col gap-5", children: _jsx(MarketPanel, { overview: overview }) }), _jsx(TabsContent, { value: "draft", className: "flex flex-col gap-5", children: _jsx(DraftPanel, { overview: overview }) }), _jsx(TabsContent, { value: "jornadas", className: "flex flex-col gap-5", children: _jsx(CompetitionPanel, { overview: overview }) }), _jsx(TabsContent, { value: "auditoria", children: _jsx(SectionCard, { title: "Registro de auditor\u00EDa", icon: ScrollText, bodyClassName: "p-0", children: _jsx(AuditList, { entries: overview.activity }) }) }), _jsx(TabsContent, { value: "catalogo", className: "flex flex-col gap-5", children: _jsx(CatalogPanel, {}) })] })] }));
}
function TournamentPanel({ overview }) {
    const setStatus = useMutation(api.tournament.setTournamentStatus);
    const [busy, setBusy] = useState(false);
    const tournament = overview.tournament;
    const update = async (status, marketOpen) => {
        setBusy(true);
        try {
            await setStatus({
                status: status,
                marketOpen,
            });
            toast.success("Estado del torneo actualizado", {
                description: `Ahora el torneo está en fase «${TOURNAMENT_STATUS_META[status].label}».`,
            });
        }
        catch (cause) {
            toast.error("No se pudo cambiar el estado", { description: errorMessage(cause) });
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(MetricCard, { label: "Clubes del torneo", value: `${overview.clubs.length}`, hint: `${overview.totals.freeClubs} sin presidente` }), _jsx(MetricCard, { label: "Plantillas registradas", value: `${overview.totals.squads}`, hint: `${overview.totals.players} jugadores asignados` }), _jsx(MetricCard, { label: "Presupuesto asignado", value: formatMoney(overview.totals.committedBudget), hint: `${overview.presidents.length} presidentes` }), _jsx(MetricCard, { label: "Jornada actual", value: `${tournament.currentMatchday} / ${tournament.totalMatchdays}`, hint: tournament.statusLabel })] }), _jsx(SectionCard, { title: "M\u00E1quina de estados del torneo", icon: Gauge, children: _jsxs("div", { className: "flex flex-col gap-4 sm:flex-row sm:items-end", children: [_jsxs("div", { className: "flex flex-1 flex-col gap-2", children: [_jsx(Label, { htmlFor: "tournamentStatus", children: "Fase actual" }), _jsxs(Select, { value: tournament.status, disabled: busy, onValueChange: (value) => update(value), children: [_jsx(SelectTrigger, { id: "tournamentStatus", className: "min-h-11", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: TOURNAMENT_STATUSES.map((status) => (_jsx(SelectItem, { value: status, className: "min-h-11", children: TOURNAMENT_STATUS_META[status].label }, status))) })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: TOURNAMENT_STATUS_META[tournament.status].hint })] }), _jsxs("div", { className: "flex items-center gap-3 rounded-lg border p-3", children: [_jsx(Switch, { id: "marketOpen", checked: tournament.marketOpen, disabled: busy, onCheckedChange: (checked) => update(tournament.status, checked) }), _jsxs(Label, { htmlFor: "marketOpen", className: "text-sm", children: ["Ventana de mercado ", tournament.marketOpen ? "abierta" : "cerrada"] })] })] }) }), _jsx(SectionCard, { title: "Clubes y presidencias", icon: Users, bodyClassName: "p-0", children: _jsx("div", { className: "overflow-x-auto scroll-thin", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { className: "bg-muted/50 hover:bg-muted/50", children: [_jsx(TableHead, { children: "Club" }), _jsx(TableHead, { children: "Liga" }), _jsx(TableHead, { className: "text-center", children: "Plantilla base" }), _jsx(TableHead, { className: "text-center", children: "OVR medio" }), _jsx(TableHead, { children: "Presidente" })] }) }), _jsx(TableBody, { children: overview.clubs.map((club) => (_jsxs(TableRow, { children: [_jsx(TableCell, { children: _jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx(Crest, { name: club.name, shortName: club.shortName, colors: [club.colorPrimary, club.colorSecondary], size: "sm" }), _jsx("span", { className: "text-sm font-semibold", children: club.name })] }) }), _jsx(TableCell, { className: "text-sm text-muted-foreground", children: club.league }), _jsx(TableCell, { className: "num text-center", children: club.rosterSize }), _jsx(TableCell, { className: "num text-center", children: club.averageOvr }), _jsx(TableCell, { children: club.presidentNickname ? (_jsx("span", { className: "text-sm font-semibold", children: club.presidentNickname })) : (_jsx(Badge, { variant: "outline", className: "text-muted-foreground", children: "Disponible" })) })] }, club.id))) })] }) }) })] }));
}
/**
 * "Modo árbitro" (prompt §40): Administración opens the draft moment and every
 * reserved agreement is validated one last time against the live state before
 * it is applied. Failures keep their human explanation in the audit log.
 */
function MarketPanel({ overview }) {
    const { executeReserved, busyKey } = useMarketActions();
    const { market } = overview;
    const busy = busyKey === "ejecutar";
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(MetricCard, { label: "Ventana de mercado", value: market.open ? "Abierta" : "Cerrada", hint: market.open
                            ? "Las operaciones se ejecutan al aceptarse"
                            : "Los acuerdos se reservan hasta que la abras" }), _jsx(MetricCard, { label: "Operaciones abiertas", value: `${market.pending}`, hint: "Ofertas esperando respuesta" }), _jsx(MetricCard, { label: "Acuerdos reservados", value: `${market.reserved.length}`, hint: "Listos para validaci\u00F3n final" }), _jsx(MetricCard, { label: "Ejecutadas recientemente", value: `${market.recent.filter((offer) => offer.status === "ejecutada").length}`, hint: `${market.recent.length} en el historial completo` })] }), _jsx(SectionCard, { title: "Centro de control del mercado", icon: Handshake, children: _jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [_jsx("p", { className: "max-w-2xl text-xs leading-relaxed text-muted-foreground", children: "Al ejecutar, cada acuerdo vuelve a comprobarse contra el estado actual de ambas plantillas, los cupos por posici\u00F3n, el l\u00EDmite por club real y los presupuestos. Si algo cambi\u00F3 desde el acuerdo, la operaci\u00F3n queda invalidada con el motivo registrado y los jugadores vuelven a estar disponibles." }), _jsxs(Button, { type: "button", className: "min-h-11 shrink-0", disabled: busy || market.reserved.length === 0, onClick: () => executeReserved(), children: [busy ? (_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" })) : (_jsx(PlayCircle, { className: "size-4", "aria-hidden": "true" })), "Validar y ejecutar reservadas"] })] }) }), _jsx(SectionCard, { title: "Acuerdos reservados", icon: ScrollText, bodyClassName: market.reserved.length === 0 ? undefined : "p-4", children: market.reserved.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "No hay acuerdos reservados. Cuando dos Presidentes lleguen a un acuerdo aparecer\u00E1 aqu\u00ED con su validaci\u00F3n final antes de aplicarse." })) : (_jsx("ul", { className: "grid gap-4 xl:grid-cols-2", children: market.reserved.map((offer) => (_jsxs("li", { className: "flex flex-col gap-2", children: [_jsx(OfferCard, { offer: offer }), _jsxs(Button, { type: "button", variant: "outline", className: "min-h-11", disabled: busy, onClick: () => executeReserved(offer.id), children: [_jsx(PlayCircle, { className: "size-4", "aria-hidden": "true" }), "Validar y ejecutar esta operaci\u00F3n"] })] }, offer.id))) })) }), _jsx(SectionCard, { title: "\u00DAltimas operaciones del torneo", icon: Users, bodyClassName: "p-0", children: market.recent.length === 0 ? (_jsx("p", { className: "p-4 text-sm text-muted-foreground", children: "Todav\u00EDa no se ha registrado ninguna operaci\u00F3n en el torneo." })) : (_jsx("ul", { className: "divide-y", children: market.recent.slice(0, 10).map((offer) => (_jsxs("li", { className: "flex flex-wrap items-center gap-2 p-3", children: [_jsx(OfferStatusPill, { status: offer.status }), _jsxs("span", { className: "min-w-0 flex-1 truncate text-sm font-semibold", children: [offer.bidderClubName, " \u2192 ", offer.sellerClubName ?? "Agente libre"] }), _jsx("span", { className: "truncate text-xs text-muted-foreground", children: offer.requested.map((player) => player.name).join(", ") || "—" }), _jsx("span", { className: "num text-xs font-bold", children: formatMoney(offer.cash) }), _jsx("span", { className: "text-[11px] text-muted-foreground", children: relativeTime(offer.updatedAt) })] }, offer.id))) })) })] }));
}
/**
 * Draft tab — the "modo árbitro" control centre (prompt §40). Prepare the
 * order, open the window (which executes reserved agreements), pause/resume
 * the clock, skip a stuck turn and close the draft.
 */
function DraftPanel({ overview }) {
    const { prepare, open, pause, resume, skipTurn, close, busyKey } = useDraftActions();
    const { draft } = overview;
    const busy = busyKey !== null;
    const [form, setForm] = useState({
        totalRounds: 4,
        pickSeconds: 300,
        snake: true,
        orderMode: "inscripcion",
    });
    const status = draft.status;
    const canPrepare = status === null || status === "borrador";
    const canOpen = status === "borrador";
    const canPause = status === "en_curso";
    const canResume = status === "pausado";
    const canSkip = status === "en_curso" || status === "pausado";
    const canClose = status === "en_curso" || status === "pausado";
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(MetricCard, { label: "Estado del draft", value: draft.statusLabel ?? "Sin preparar", hint: draft.statusHint ?? "Todavía no se ha preparado un orden de turnos" }), _jsx(MetricCard, { label: "Turno actual", value: draft.currentNickname ?? "—", hint: draft.currentClubName
                            ? `Preside ${draft.currentClubName}`
                            : "Nadie tiene el turno" }), _jsx(MetricCard, { label: "Adquisiciones", value: `${draft.totalPicks}`, hint: `Ronda ${draft.round} de ${draft.totalRounds} · orden de ${draft.orderSize}` }), _jsx(MetricCard, { label: "Acuerdos reservados", value: `${draft.reservedPending}`, hint: draft.reservedPending > 0
                            ? "Se validarán al abrir el draft"
                            : "Nada pendiente de ejecución" })] }), _jsx(SectionCard, { title: "Control del draft", icon: Zap, children: _jsxs("div", { className: "flex flex-col gap-4", children: [_jsx("div", { className: "flex flex-wrap items-center gap-2", children: _jsx(DraftStatusPill, { status: draft.status }) }), _jsx("p", { className: "max-w-3xl text-xs leading-relaxed text-muted-foreground", children: "Abrir el draft cierra la ventana de mercado y ejecuta los acuerdos reservados con validaci\u00F3n final. Cada turno tiene reloj; pausar lo detiene para todos. Cerrar el draft fija las plantillas y devuelve el torneo a la fase previa a la competici\u00F3n." }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [canOpen ? (_jsxs(Button, { type: "button", className: "min-h-11", disabled: busy, onClick: () => open(), children: [_jsx(PlayCircle, { className: "size-4", "aria-hidden": "true" }), "Abrir draft"] })) : null, canPause ? (_jsxs(Button, { type: "button", variant: "outline", className: "min-h-11", disabled: busy, onClick: () => pause(), children: [_jsx(PauseCircle, { className: "size-4", "aria-hidden": "true" }), "Pausar"] })) : null, canResume ? (_jsxs(Button, { type: "button", className: "min-h-11", disabled: busy, onClick: () => resume(), children: [_jsx(PlayCircle, { className: "size-4", "aria-hidden": "true" }), "Reanudar"] })) : null, canSkip ? (_jsxs(Button, { type: "button", variant: "outline", className: "min-h-11", disabled: busy, onClick: () => skipTurn(), children: [_jsx(SkipForward, { className: "size-4", "aria-hidden": "true" }), "Saltar turno"] })) : null, canClose ? (_jsxs(Button, { type: "button", variant: "outline", className: "min-h-11 border-rose-500/40 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300", disabled: busy, onClick: () => close(), children: [_jsx(StopCircle, { className: "size-4", "aria-hidden": "true" }), "Cerrar draft"] })) : null] }), draft.currentDeadline !== null && draft.status === "en_curso" ? (_jsxs("p", { className: "flex items-center gap-2 text-xs text-muted-foreground", children: [_jsx(Hourglass, { className: "size-3.5", "aria-hidden": "true" }), "Turno de ", draft.currentNickname, ": cierra en", " ", _jsx(Countdown, { target: draft.currentDeadline, label: "", compact: true })] })) : null] }) }), _jsxs(SectionCard, { title: "Orden de turnos", icon: Users, children: [_jsx(TurnStrip, { order: draft.turnOrder }), draft.unsignedPresidents.length > 0 ? (_jsxs("p", { className: "mt-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.06] p-3 text-xs text-amber-800 dark:text-amber-200", children: [_jsx(AlertTriangle, { className: "mt-0.5 size-3.5 shrink-0", "aria-hidden": "true" }), draft.unsignedPresidents.length, " Presidente(s) se unieron despu\u00E9s de preparar el orden: ", draft.unsignedPresidents.join(", "), ". Vuelve a preparar el draft para incluirlos."] })) : null] }), canPrepare ? (_jsxs(SectionCard, { title: "Preparar draft", icon: Zap, children: [_jsx("p", { className: "mb-4 text-xs text-muted-foreground", children: "Configura rondas, reloj por turno y el orden antes de abrir. Puedes volver a preparar el draft mientras siga cerrado." }), _jsxs("form", { className: "grid gap-4 sm:grid-cols-2", onSubmit: (event) => {
                            event.preventDefault();
                            void prepare(form);
                        }, children: [_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx(Label, { htmlFor: "draftRounds", className: "text-xs", children: "Rondas" }), _jsx(Input, { id: "draftRounds", type: "number", min: 1, max: 30, className: "h-11", value: form.totalRounds, onChange: (event) => setForm((prev) => ({
                                            ...prev,
                                            totalRounds: Math.max(1, Number(event.target.value) || 1),
                                        })) }), _jsxs("p", { className: "text-[11px] text-muted-foreground", children: ["Con ", draft.orderSize, " Presidente(s) ser\u00E1n", " ", draft.orderSize * form.totalRounds, " turnos en total."] })] }), _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx(Label, { htmlFor: "draftSeconds", className: "text-xs", children: "Segundos por turno" }), _jsx(Input, { id: "draftSeconds", type: "number", min: 30, step: 30, className: "h-11", value: form.pickSeconds, onChange: (event) => setForm((prev) => ({
                                            ...prev,
                                            pickSeconds: Math.max(30, Number(event.target.value) || 30),
                                        })) }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: "Si el reloj llega a cero, Administraci\u00F3n puede saltar el turno." })] }), _jsxs("div", { className: "flex items-center justify-between gap-3 rounded-xl border p-3", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "draftSnake", className: "text-xs font-semibold", children: "Orden serpiente" }), _jsx("p", { className: "mt-0.5 text-[11px] text-muted-foreground", children: "Las rondas pares invierten el orden, como en un draft real." })] }), _jsx(Switch, { id: "draftSnake", checked: form.snake, onCheckedChange: (checked) => setForm((prev) => ({ ...prev, snake: checked })) })] }), _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx(Label, { htmlFor: "draftOrder", className: "text-xs", children: "Orden de turnos" }), _jsxs(Select, { value: form.orderMode, onValueChange: (value) => setForm((prev) => ({
                                            ...prev,
                                            orderMode: value,
                                        })), children: [_jsx(SelectTrigger, { id: "draftOrder", className: "h-11", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "inscripcion", children: "Por orden de inscripci\u00F3n" }), _jsx(SelectItem, { value: "sorteo", children: "Sorteo" })] })] })] }), _jsx("div", { className: "sm:col-span-2", children: _jsxs(Button, { type: "submit", className: "min-h-11", disabled: busy, children: [busy ? (_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" })) : (_jsx(Zap, { className: "size-4", "aria-hidden": "true" })), status === "borrador" ? "Repreparar draft" : "Preparar draft"] }) })] })] })) : null, _jsx(SectionCard, { title: "Historial de adquisiciones", icon: ScrollText, bodyClassName: draft.picks.length === 0 ? undefined : "p-0", children: draft.picks.length === 0 ? (_jsx("p", { className: "p-4 text-sm text-muted-foreground", children: "Cada adquisici\u00F3n del draft quedar\u00E1 registrada aqu\u00ED con su Presidente, su precio y su ronda." })) : (_jsx("ul", { className: "divide-y", children: draft.picks
                        .slice()
                        .reverse()
                        .slice(0, 20)
                        .map((pickRow) => (_jsxs("li", { className: "flex flex-wrap items-center gap-3 px-4 py-3", children: [_jsx("span", { className: "num flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold", children: pickRow.pickNumber }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("p", { className: "truncate text-sm font-semibold", children: [pickRow.playerName, " ", _jsxs("span", { className: "text-xs font-normal text-muted-foreground", children: [pickRow.position, " \u00B7 ", pickRow.realClub] })] }), _jsxs("p", { className: "truncate text-[11px] text-muted-foreground", children: ["Ronda ", pickRow.round, " \u00B7 ", pickRow.nickname, " (", pickRow.clubName, ")", pickRow.mode === "reserva"
                                                ? " · acuerdo reservado"
                                                : ""] })] }), _jsx("span", { className: "num text-sm font-bold", children: formatMoney(pickRow.price) })] }, pickRow.id))) })) })] }));
}
function MetricCard({ label, value, hint, }) {
    return (_jsxs("div", { className: "card-soft p-4", children: [_jsx("p", { className: "text-[11px] font-bold uppercase tracking-wide text-muted-foreground", children: label }), _jsx("p", { className: "num display mt-1 text-xl", children: value }), hint ? _jsx("p", { className: "mt-0.5 text-[11px] text-muted-foreground", children: hint }) : null] }));
}
/**
 * Competition control: the "modo árbitro" for the calendar. The admin sees
 * the current matchday, its fixtures and closes it — the engine resolves
 * every match from the saved lineups and advances the tournament.
 */
function CompetitionPanel({ overview }) {
    const { sync, closeMatchday, busy } = useCompetitionActions();
    const competition = overview.competition;
    const current = competition.matchdays.find((group) => group.status === "en_curso");
    const leader = competition.leader;
    const [reportMatchday, setReportMatchday] = useState(String(competition.currentMatchday));
    const reportGroup = competition.matchdays.find((group) => String(group.matchday) === reportMatchday) ??
        current;
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(MetricCard, { label: "Jornada en curso", value: competition.available ? `J${competition.currentMatchday}` : "—", hint: competition.available
                            ? `${competition.calendarMatchdays} jornadas en el calendario`
                            : "Calendario sin generar" }), _jsx(MetricCard, { label: "Partidos jugados", value: `${competition.playedCount}/${competition.totalCount}`, hint: `${competition.playedCount} resueltos de ${competition.totalCount} programados` }), _jsx(MetricCard, { label: "L\u00EDder", value: leader ? leader.clubShortName : "—", hint: leader
                            ? `${leader.points} pts · ${leader.won}V ${leader.drawn}E ${leader.lost}D`
                            : "Sin partidos jugados todavía" }), _jsx(MetricCard, { label: "Temporada", value: `${competition.currentMatchday}/${competition.totalMatchdays}`, hint: `${overview.tournament?.season ?? "—"} · cierre de jornada manual` })] }), _jsx(SectionCard, { title: `Cerrar jornada ${competition.currentMatchday}`, icon: Swords, accent: "gold", children: _jsxs("div", { className: "flex flex-col gap-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Al cerrar la jornada, cada partido se resuelve con los 11 titulares guardados en la Formaci\u00F3n de cada club (snapshot auditable: los fichajes posteriores no reescriben resultados). La tabla se recalcula y la siguiente jornada pasa a estar en curso." }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Button, { variant: "outline", onClick: () => void sync(), disabled: busy, className: "min-h-10", children: [_jsx(RefreshCw, { className: "size-4", "aria-hidden": "true" }), "Sincronizar calendario"] }), _jsxs(Button, { onClick: () => void closeMatchday(competition.currentMatchday), disabled: busy || !competition.available, className: "min-h-10", children: [busy ? (_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" })) : (_jsx(Swords, { className: "size-4", "aria-hidden": "true" })), "Cerrar jornada ", competition.currentMatchday] })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: current
                                ? `${current.playedCount}/${current.fixtures.length} partido(s) ya resueltos en esta jornada; el resto se resuelve al cerrar.`
                                : "No hay jornada en curso: cierra una para activar la siguiente." })] }) }), _jsxs(SectionCard, { title: "Resultados detallados (modo \u00E1rbitro)", icon: ScrollText, bodyClassName: "flex flex-col gap-3", children: [_jsx("p", { className: "max-w-3xl text-sm text-muted-foreground", children: "Indica el resultado de cada partido a mano: marcador, goles por jugador, tarjetas amarillas y rojas por jugador, y los lesionados con el n\u00FAmero de jornadas que estar\u00E1n de baja. La tabla del torneo se actualiza al instante y todo queda en la auditor\u00EDa." }), _jsxs("div", { className: "flex flex-col gap-1.5 sm:max-w-xs", children: [_jsx(Label, { htmlFor: "reportMatchday", className: "text-xs", children: "Jornada a registrar" }), _jsxs(Select, { value: reportMatchday, onValueChange: setReportMatchday, children: [_jsx(SelectTrigger, { id: "reportMatchday", className: "min-h-11", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { className: "max-h-72", children: competition.matchdays.map((group) => (_jsxs(SelectItem, { value: String(group.matchday), className: "min-h-10", children: ["Jornada ", group.matchday, _jsxs("span", { className: "text-muted-foreground", children: [" ", "\u00B7 ", group.playedCount, "/", group.fixtures.length, " jugados \u00B7 ", group.statusLabel] })] }, group.matchday))) })] })] }), reportGroup && reportGroup.fixtures.length > 0 ? (_jsx("ul", { className: "flex flex-col gap-2", children: reportGroup.fixtures.map((fixture) => (_jsxs("li", { className: "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3", children: [_jsxs("div", { className: "flex min-w-0 flex-1 items-center gap-2 text-sm", children: [_jsx("span", { className: "truncate font-semibold", children: fixture.home.name }), fixture.homeGoals !== null && fixture.awayGoals !== null ? (_jsxs("span", { className: "num shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-bold", children: [fixture.homeGoals, " \u2013 ", fixture.awayGoals] })) : (_jsx("span", { className: "shrink-0 text-xs text-muted-foreground", children: "vs" })), _jsx("span", { className: "truncate font-semibold", children: fixture.away.name }), fixture.status === "jugado" ? (_jsx("span", { className: "shrink-0 text-[11px] text-muted-foreground", children: "Jugado" })) : null] }), _jsx(ResultReportButton, { fixture: fixture })] }, fixture.id))) })) : (_jsx("p", { className: "text-sm text-muted-foreground", children: "Esta jornada todav\u00EDa no tiene partidos: genera el calendario desde \u00ABSincronizar calendario\u00BB." }))] }), _jsx(SectionCard, { title: "Partido destacado de la jornada", icon: Swords, children: current && current.fixtures.length > 0 ? (_jsx("div", { className: "flex flex-col gap-2", children: current.fixtures.map((fixture) => (_jsx(MatchCard, { fixture: fixture }, fixture.id))) })) : (_jsx("p", { className: "text-sm text-muted-foreground", children: "Sin partidos programados en la jornada en curso." })) }), _jsx(SectionCard, { title: "Tabla del torneo", icon: Trophy, children: competition.available ? (_jsx(StandingsTable, { rows: competition.standings })) : (_jsx("p", { className: "text-sm text-muted-foreground", children: "La tabla aparece en cuanto exista el calendario." })) })] }));
}
function RulesPanel({ rules, presidents, clubCount, }) {
    const updateRules = useMutation(api.tournament.updateRules);
    const [form, setForm] = useState(rules);
    const [busy, setBusy] = useState(false);
    // Re-sync the editor when the server rules change (react.dev: adjusting state
    // when a prop changes) without an extra render from an effect.
    const serverKey = JSON.stringify(rules);
    const [draftKey, setDraftKey] = useState(serverKey);
    if (draftKey !== serverKey) {
        setDraftKey(serverKey);
        setForm(rules);
    }
    const errors = useMemo(() => {
        const list = [];
        const groups = [
            ["porteros", form.gkMin, form.gkMax],
            ["defensas", form.defMin, form.defMax],
            ["medios", form.midMin, form.midMax],
            ["delanteros", form.fwdMin, form.fwdMax],
        ];
        for (const [label, min, max] of groups) {
            if (min > max)
                list.push(`En ${label} el mínimo no puede superar al máximo.`);
        }
        if (form.squadSize < 11 || form.squadSize > 40) {
            list.push("El tamaño de plantilla debe estar entre 11 y 40 jugadores.");
        }
        const minTotal = form.gkMin + form.defMin + form.midMin + form.fwdMin;
        if (minTotal > form.squadSize) {
            list.push(`Los mínimos por posición suman ${minTotal} jugadores y no caben en una plantilla de ${form.squadSize}.`);
        }
        if (form.maxU21 < 0 || form.maxU21 > 15) {
            list.push("El límite de jugadores sub-21 debe estar entre 0 y 15.");
        }
        if (form.budget < 0)
            list.push("El presupuesto no puede ser negativo.");
        return list;
    }, [form]);
    const impacted = presidents.filter((president) => president.squadSize > form.squadSize);
    const dirty = JSON.stringify(form) !== JSON.stringify(rules);
    const submit = async (event) => {
        event.preventDefault();
        if (errors.length > 0)
            return;
        setBusy(true);
        try {
            const result = await updateRules(form);
            toast.success("Reglas del torneo actualizadas", {
                description: result.changed > 0
                    ? `${result.changed} regla(s) modificadas. El motor de reglas ya las aplica.`
                    : "No había cambios que registrar.",
            });
        }
        catch (cause) {
            toast.error("No se pudieron guardar las reglas", {
                description: errorMessage(cause),
            });
        }
        finally {
            setBusy(false);
        }
    };
    const numberField = (key, label, options) => (_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx(FieldLabel, { htmlFor: key, tip: options?.tip ??
                    `${label}: valor numérico que el motor de reglas aplica a toda la liga en tiempo real.`, children: label }), _jsx(Input, { id: key, type: "number", className: "h-11", value: form[key], step: options?.step ?? 1, onChange: (event) => setForm((previous) => ({
                    ...previous,
                    [key]: Number(event.target.value),
                })) }), options?.hint ? (_jsx("p", { className: "text-[11px] text-muted-foreground", children: options.hint })) : null] }));
    return (_jsxs("form", { onSubmit: submit, className: "flex flex-col gap-5", children: [_jsx(SectionCard, { title: "Reglas del torneo", icon: ScrollText, children: _jsxs("div", { className: "grid gap-4", children: [_jsxs("fieldset", { className: "grid gap-4 sm:grid-cols-3", children: [_jsx("legend", { className: "mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground", children: "Presupuesto y plantilla" }), _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx(FieldLabel, { htmlFor: "budgetMillions", tip: "Cu\u00E1nto dinero recibe cada Presidente al unirse a la liga (y al reiniciarla). Con \u00E9l ficha agentes libres y negocia en el mercado. Escribe el importe en millones: 50 = 50.000.000 \u20AC. No modifica los presupuestos ya gastados; lo que se suma despu\u00E9s llega v\u00EDa premios o presupuestos extra.", children: "Presupuesto inicial por Presidente (millones \u20AC)" }), _jsx(Input, { id: "budgetMillions", type: "number", className: "h-11", step: 5, value: Math.round(form.budget / 1000000), onChange: (event) => setForm((previous) => ({
                                                ...previous,
                                                budget: Number(event.target.value) * 1000000,
                                            })) }), _jsxs("p", { className: "text-[11px] text-muted-foreground", children: ["Se asigna a cada Presidente nuevo: ", formatMoney(form.budget)] })] }), numberField("squadSize", "Tamaño máximo de plantilla", {
                                    hint: "Entre 11 y 40 jugadores",
                                    tip: "Máximo de jugadores que puede acumular un club (entre 11 y 40). Si lo bajas, los clubes que lo superen quedan marcados como incumplidos hasta que ajusten su plantilla. Cuanto más pequeño, más disputa por las grandes estrellas.",
                                }), numberField("maxU21", "Máximo de jugadores sub-21", {
                                    tip: "Cuántos jugadores de 21 años o menos puede tener cada plantilla (entre 0 y 15). Úsalo para obligar a mezclar promesas con experiencia: 0 = prohibidos, 15 = plantilla muy joven.",
                                }), numberField("maxPerRealClub", "Máximo por club real", {
                                    hint: "Evita concentrar la plantilla",
                                    tip: "Máximo de jugadores del MISMO club del mundo que puedes tener a la vez (p. ej. no más de 2 del Real Madrid). Evita que todos repitan la once titular de un equipo. El valor mínimo habitual es 1.",
                                }), numberField("minOvr", "Valoración (OVR) mínima para fichar", {
                                    tip: "No se permite fichar a nadie con valoración general (OVR) por debajo de este número. Baja el valor si quieres permitir madera joven o suplentes; súbelo para un mercado exclusivo de estrellas.",
                                }), numberField("lineupLockHours", "Cierre de alineación (horas antes)", {
                                    hint: "Aplica a cada jornada",
                                    tip: "Horas antes del kickoff de cada jornada en que tu alineación titular queda congelada: después no puedes cambiarla hasta el siguiente partido. 0 = se bloquea al cerrar la jornada. P. ej. 1 = hasta una hora antes.",
                                })] }), _jsxs("fieldset", { className: "grid gap-4 sm:grid-cols-4", children: [_jsx("legend", { className: "mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground", children: "Cupos por posici\u00F3n" }), numberField("gkMin", "Porteros · mínimo", {
                                    tip: "Cuántos porteros (POR) debe tener como mínimo cada plantilla para poder alinear (lo habitual es 2). Si un club queda por debajo, el motor lo marca como incumplido hasta que lo repare.",
                                }), numberField("gkMax", "Porteros · máximo", {
                                    tip: "Tope de porteros por plantilla (p. ej. 3). Deja siempre el máximo por encima del mínimo para que haya margen de elección.",
                                }), numberField("defMin", "Defensas · mínimo", {
                                    tip: "Defensas (LD, DFC, LI) obligatorios en plantilla. Lo habitual es 4 o más para poder rotar en tres centrales o laterales.",
                                }), numberField("defMax", "Defensas · máximo", {
                                    tip: "Tope de defensas: evita plantillas de solo defensas y obliga a repartir el presupuesto entre líneas.",
                                }), numberField("midMin", "Medios · mínimo", {
                                    tip: "Mediocampistas (MCD, MC, MCO) obligatorios. Sin al menos 3-4 no podrás cubrir formaciones con mediocampo cargado.",
                                }), numberField("midMax", "Medios · máximo", {
                                    tip: "Tope de mediocampistas por plantilla para que el mercado tenga demanda en todas las líneas.",
                                }), numberField("fwdMin", "Delanteros · mínimo", {
                                    tip: "Delanteros (ED, EI, DC) obligatorios. Lo habitual es 3 o más para asegurar gol en cualquier formación.",
                                }), numberField("fwdMax", "Delanteros · máximo", {
                                    tip: "Tope de delanteros: impide acumular solo goleadores y garantiza plantillas equilibradas.",
                                })] })] }) }), errors.length > 0 ? (_jsxs("div", { className: "rounded-xl border border-rose-500/35 bg-rose-500/[0.06] p-4", children: [_jsxs("p", { className: "flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300", children: [_jsx(AlertTriangle, { "aria-hidden": "true", className: "size-4" }), "Revisa estas reglas antes de guardar"] }), _jsx("ul", { className: "mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground", children: errors.map((error) => (_jsx("li", { children: error }, error))) })] })) : null, impacted.length > 0 ? (_jsxs("div", { className: "rounded-xl border border-amber-500/35 bg-amber-500/[0.07] p-4", children: [_jsxs("p", { className: "flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300", children: [_jsx(AlertTriangle, { "aria-hidden": "true", className: "size-4" }), "Impacto en presidencias actuales"] }), _jsxs("p", { className: "mt-2 text-xs text-muted-foreground", children: [impacted.length, " club(es) superar\u00EDan el nuevo m\u00E1ximo de", " ", form.squadSize, " jugadores:", " ", impacted
                                .slice(0, 4)
                                .map((president) => `${president.clubName} (${president.squadSize})`)
                                .join(", "), impacted.length > 4 ? ` y ${impacted.length - 4} más` : "", ". El motor marcar\u00E1 sus plantillas como incumplidas hasta que se ajusten."] })] })) : null, _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx(Button, { type: "submit", className: "min-h-11", disabled: busy || errors.length > 0 || !dirty, children: busy ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" }), "Guardando\u2026"] })) : ("Guardar reglas") }), _jsx(Button, { type: "button", variant: "outline", className: "min-h-11", disabled: !dirty || busy, onClick: () => setForm(rules), children: "Descartar cambios" }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [clubCount, " clubes \u00B7 ", presidents.length, " presidentes afectados por estas reglas."] })] }), _jsx(SectionCard, { title: "Referencia de reglas", icon: ScrollText, bodyClassName: "p-0", children: _jsx("ul", { className: "divide-y", children: RULE_DESCRIPTORS.map((descriptor) => (_jsxs("li", { className: "flex items-start gap-3 p-3", children: [_jsx("span", { className: "display mt-0.5 rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground", children: descriptor.code }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm font-semibold", children: descriptor.title }), _jsx("p", { className: "text-xs text-muted-foreground", children: descriptor.description })] }), _jsx("span", { className: "num ml-auto shrink-0 text-sm font-semibold text-primary", children: descriptor.value(form) })] }, descriptor.code))) }) })] }));
}
function PresidentsPanel({ overview }) {
    const grantAdmin = useMutation(api.tournament.grantAdmin);
    const revokeAdmin = useMutation(api.tournament.revokeAdmin);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("coAdmin");
    const [permissions, setPermissions] = useState(["mercado", "jugadores"]);
    const [busy, setBusy] = useState(false);
    const now = useNow(60000);
    const submit = async (event) => {
        event.preventDefault();
        setBusy(true);
        try {
            const result = await grantAdmin({ email, role, permissions });
            toast.success("Rol administrativo asignado", {
                description: `${email} ahora tiene ${result.granted} permiso(s) en el torneo.`,
            });
            setEmail("");
        }
        catch (cause) {
            toast.error("No se pudo asignar el rol", { description: errorMessage(cause) });
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(_Fragment, { children: [overview.tournament ? _jsx(InviteCard, { code: overview.tournament.code }) : null, _jsx(SectionCard, { title: "Presidentes del torneo", icon: Users, bodyClassName: "p-0", children: _jsx("div", { className: "overflow-x-auto scroll-thin", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { className: "bg-muted/50 hover:bg-muted/50", children: [_jsx(TableHead, { children: "Presidente" }), _jsx(TableHead, { children: "Club" }), _jsx(TableHead, { className: "text-center", children: "Plantilla" }), _jsx(TableHead, { className: "text-right", children: "Presupuesto" }), _jsx(TableHead, { children: "Rol administrativo" }), _jsx(TableHead, { children: "Acciones" }), _jsx(TableHead, { children: "Se unioprova" })] }) }), _jsxs(TableBody, { children: [overview.presidents.map((president) => (_jsxs(TableRow, { children: [_jsxs(TableCell, { children: [_jsx("p", { className: "text-sm font-semibold", children: president.displayName }), _jsxs("p", { className: "text-[11px] text-muted-foreground", children: [president.nickname, " \u00B7 ", president.email] })] }), _jsx(TableCell, { className: "text-sm", children: president.clubName }), _jsx(TableCell, { className: "num text-center", children: president.squadSize }), _jsxs(TableCell, { className: "text-right", children: [_jsx("span", { className: "num block font-semibold", children: formatMoney(president.budget) }), president.budgetExtra > 0 ? (_jsxs("span", { className: "num block text-[11px] text-emerald-700 dark:text-emerald-300", children: ["+", formatMoney(president.budgetExtra), " extra"] })) : null] }), _jsx(TableCell, { children: president.adminRole ? (_jsxs("span", { className: "flex items-center gap-2", children: [_jsx(Badge, { variant: "outline", className: "border-gold/40 bg-gold/15 text-amber-700 dark:text-amber-300", children: president.adminRole === "principal"
                                                                ? "Administrador principal"
                                                                : "Co-Administrador" }), _jsx(Button, { type: "button", variant: "ghost", size: "sm", className: "min-h-9", onClick: () => revokeAdmin({ userId: president.userId }), children: "Retirar" })] })) : (_jsx("span", { className: "text-xs text-muted-foreground", children: "Presidencia" })) }), _jsx(TableCell, { children: _jsxs("div", { className: "flex flex-wrap gap-1.5", children: [_jsx(ChangeClubDialog, { president: president, teams: overview.availableTeams }), _jsx(GrantBudgetDialog, { president: president }), _jsx(RemovePresidentDialog, { president: president })] }) }), _jsx(TableCell, { className: "text-xs text-muted-foreground", children: relativeTime(president.joinedAt, now) })] }, president.id))), overview.presidents.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 7, className: "text-sm text-muted-foreground", children: "Todav\u00EDa no hay Presidentes registrados en el torneo." }) })) : null] })] }) }) }), _jsx(SectionCard, { title: "Invitar a un Administrador", icon: UserPlus, children: _jsxs("form", { onSubmit: submit, className: "flex flex-col gap-4", children: [_jsxs("p", { className: "text-xs leading-relaxed text-muted-foreground", children: ["El rol administrativo se asigna a una cuenta existente: la persona debe registrarse primero con ese correo. Puede seguir siendo Presidente de su club. Para invitar a nuevos ", _jsx("strong", { children: "Presidentes" }), " usa el link compartible de arriba."] }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx(FieldLabel, { htmlFor: "adminEmail", tip: "Correo con el que esa persona YA tiene cuenta en 11Eleven. Si a\u00FAn no est\u00E1 registrada, p\u00EDdele que cree la cuenta con este correo y vuelve a asignarle el rol. Este campo no invita Presidentes: para eso comparte el link.", children: "Correo electr\u00F3nico de la cuenta" }), _jsx(Input, { id: "adminEmail", type: "email", className: "h-11", value: email, onChange: (event) => setEmail(event.target.value), placeholder: "presidente@correo.com", required: true })] }), _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx(FieldLabel, { htmlFor: "adminRole", tip: "Administrador principal: control total (reglas, presidentes, resultados, premios y reinicio) y todos los permisos. Co-Administrador: solo los permisos que marques abajo. Ambos roles conviven con la presidencia de un club.", children: "Rol administrativo" }), _jsxs(Select, { value: role, onValueChange: (value) => setRole(value), children: [_jsx(SelectTrigger, { id: "adminRole", className: "min-h-11", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "coAdmin", className: "min-h-11", children: "Co-Administrador (permisos configurables)" }), _jsx(SelectItem, { value: "principal", className: "min-h-11", children: "Administrador principal (todos los permisos)" })] })] })] })] }), role === "coAdmin" ? (_jsxs("fieldset", { children: [_jsxs("legend", { className: "mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground", children: ["Permisos del Co-Administrador", _jsx(Tip, { side: "right", text: "Marca lo que podr\u00E1 hacer: \u00ABCalendario\u00BB = cerrar jornadas y registrar resultados detallados; \u00ABPresidentes\u00BB = cambiar equipos, eliminar presidencias y asignar presupuesto extra; \u00ABConfiguraci\u00F3n\u00BB = reglas, competici\u00F3n FC 27, premios y reinicio de liga. D\u00E9jalo vac\u00EDo para un rol de solo lectura." })] }), _jsx("div", { className: "grid gap-2 sm:grid-cols-3", children: Object.entries(PERMISSION_LABELS).map(([key, label]) => {
                                        const checked = permissions.includes(key);
                                        return (_jsxs("label", { className: "flex min-h-11 items-center gap-2 rounded-lg border p-2.5 text-sm", children: [_jsx(Checkbox, { checked: checked, onCheckedChange: (value) => setPermissions((previous) => value
                                                        ? [...previous, key]
                                                        : previous.filter((item) => item !== key)) }), label] }, key));
                                    }) })] })) : null, _jsx(Button, { type: "submit", className: "min-h-11 self-start", disabled: busy, children: busy ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" }), "Asignando\u2026"] })) : ("Asignar rol") })] }) }), _jsx(SectionCard, { title: "Administradores actuales", icon: ShieldCheck, bodyClassName: "p-0", children: _jsx("ul", { className: "divide-y", children: overview.admins.map((admin) => (_jsxs("li", { className: "flex flex-col gap-2 p-3 sm:flex-row sm:items-center", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm font-semibold", children: admin.displayName }), _jsx("p", { className: "text-[11px] text-muted-foreground", children: admin.email })] }), _jsx(Badge, { variant: "outline", children: admin.role === "principal" ? "Administrador principal" : "Co-Administrador" }), _jsxs("p", { className: "text-[11px] text-muted-foreground", children: [admin.permissions.length, " permiso(s)"] })] }, admin.id))) }) })] }));
}
function AuditList({ entries }) {
    const now = useNow(60000);
    return (_jsxs("ul", { className: "divide-y", children: [entries.map((entry) => (_jsxs("li", { className: "flex flex-col gap-1 p-3 sm:flex-row sm:gap-4", children: [_jsx("span", { className: "num shrink-0 text-[11px] text-muted-foreground sm:w-32", children: new Date(entry.createdAt).toLocaleString("es-ES", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                        }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm font-semibold", children: entry.action }), _jsx("p", { className: "text-xs leading-snug text-muted-foreground", children: entry.detail })] }), _jsxs("span", { className: "shrink-0 text-[11px] text-muted-foreground", children: [entry.actorName, " \u00B7 ", relativeTime(entry.createdAt, now)] })] }, entry.id))), entries.length === 0 ? (_jsx("li", { className: "p-4 text-sm text-muted-foreground", children: "Todav\u00EDa no hay operaciones registradas." })) : null] }));
}
