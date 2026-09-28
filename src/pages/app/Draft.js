import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { GROUP_LABEL, POSITION_LABEL, formatMoney, } from "@/convex/rulesEngine";
import { useOutletContext } from "react-router";
import { useQuery } from "convex/react";
import { relativeTime } from "@/lib/errors";
import { useNow } from "@/hooks/use-tournament";
import { useDraftActions } from "@/hooks/use-draft-actions";
import { SectionCard, StatTile } from "@/components/eleven/SectionCard";
import { DraftStatusPill, TurnStrip } from "@/components/eleven/DraftBits";
import { PlayerAvatar, PositionPill } from "@/components/eleven/PlayerBits";
import { RuleCheckList } from "@/components/eleven/RuleCheckList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { AlertTriangle, Clock, Coins, Gavel, History, Info, Loader2, Search, ShieldCheck, ShoppingCart, Users, UserX, } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Draft Control Center (prompt §11). The President sees whose turn it is, how
 * long that turn has left, what the pool offers and — only when it is their
 * turn — a picker with the same live checks the mutation will re-run.
 */
export default function Draft() {
    useOutletContext();
    const now = useNow(1000);
    const control = useQuery(api.draft.control);
    const [group, setGroup] = useState("todos");
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("ovr");
    const [target, setTarget] = useState(null);
    const { pick, busyKey } = useDraftActions();
    const summary = control?.summary ?? null;
    const draftActive = summary?.status === "en_curso";
    const myTurn = Boolean(summary?.isMyTurn);
    const pool = useQuery(api.draft.pool, draftActive
        ? {
            search: search.trim() || undefined,
            group: group === "todos" ? undefined : group,
            sort,
            limit: 60,
        }
        : "skip");
    const banner = useMemo(() => {
        if (!summary || summary.status === null) {
            return {
                tone: "muted",
                icon: Info,
                title: "El draft no está preparado",
                detail: "Administración definirá el orden de turnos y lo abrirá cuando el mercado esté listo. Te avisaremos aquí mismo.",
            };
        }
        if (summary.status === "borrador") {
            return {
                tone: "muted",
                icon: Info,
                title: "Draft preparado · esperando apertura",
                detail: "El orden de turnos ya está aprobado pero el draft sigue cerrado. Cuando Administración lo abra, el primer Presidente tendrá el turno.",
            };
        }
        if (summary.status === "pausado") {
            return {
                tone: "warning",
                icon: Clock,
                title: "Draft en pausa",
                detail: "El reloj está detenido y nadie puede fichar hasta que Administración reanude los turnos.",
            };
        }
        if (summary.status === "cerrado") {
            return {
                tone: "muted",
                icon: History,
                title: "Draft cerrado · plantillas bloqueadas",
                detail: `${summary.totalPicks} adquisición(es) registradas. Ahora solo puedes ajustar tu once en Formación.`,
            };
        }
        if (myTurn) {
            return {
                tone: "positive",
                icon: Gavel,
                title: "¡Es tu turno!",
                detail: "Elige un jugador del pool disponible. La operación se valida contra las reglas antes de aplicarse.",
            };
        }
        return {
            tone: "info",
            icon: Clock,
            title: `Turno de ${summary.currentNickname ?? "otro Presidente"}`,
            detail: "El pool se actualiza al instante: si alguien ficha a un jugador, desaparece de tu lista en cuanto lo confirma.",
        };
    }, [summary, myTurn]);
    return (_jsxs("div", { className: "mx-auto flex w-full max-w-[1400px] flex-col gap-5", children: [_jsxs("header", { className: "flex flex-col gap-2", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx("h1", { className: "display text-2xl", children: "Draft" }), _jsx(DraftStatusPill, { status: summary?.status ?? null }), summary && summary.status !== null ? (_jsxs(Badge, { variant: "outline", children: ["Ronda ", summary.round, " de ", summary.totalRounds] })) : null] }), _jsx("p", { className: "max-w-3xl text-sm text-muted-foreground", children: "Turnos cronometrados: cada adquisici\u00F3n se refleja en tiempo real para todo el torneo, y los acuerdos reservados del mercado se ejecutan al abrir el draft." })] }), _jsxs("div", { role: "status", className: cn("flex items-start gap-3 rounded-xl border p-4", banner.tone === "positive" &&
                    "border-emerald-500/40 bg-emerald-500/[0.07]", banner.tone === "warning" && "border-amber-500/40 bg-amber-500/[0.06]", banner.tone === "info" && "border-primary/30 bg-primary/[0.05]", banner.tone === "muted" && "border-border bg-card"), children: [_jsx(banner.icon, { "aria-hidden": "true", className: cn("mt-0.5 size-5 shrink-0", banner.tone === "positive" &&
                            "text-emerald-600 dark:text-emerald-300", banner.tone === "warning" && "text-amber-600 dark:text-amber-300", banner.tone === "info" && "text-primary", banner.tone === "muted" && "text-muted-foreground") }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm font-bold", children: banner.title }), _jsx("p", { className: "mt-0.5 text-sm text-muted-foreground", children: banner.detail }), summary && summary.status === "en_curso" && summary.currentDeadline !== null ? (_jsxs("p", { className: "mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", children: ["Turno de ", summary.currentNickname, _jsx(CountdownInline, { target: summary.currentDeadline, now: now })] })) : null] })] }), summary ? (_jsxs("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6", children: [_jsx(StatTile, { icon: Users, label: "Plantilla", value: `${summary.squadSize}/${summary.squadSizeLimit}` }), _jsx(StatTile, { icon: Coins, label: "Presupuesto", value: formatMoney(summary.myBudget) }), _jsx(StatTile, { icon: Search, label: "Pool libre", value: `${summary.poolSize}` }), _jsx(StatTile, { icon: ShoppingCart, label: "Fichajes del draft", value: `${summary.totalPicks}` }), _jsx(StatTile, { icon: ShieldCheck, label: "Reservadas ejecutadas", value: `${summary.executedReserved}` }), _jsx(StatTile, { icon: UserX, label: "Reservadas invalidadas", value: `${summary.invalidatedReserved}` })] })) : null, _jsx(TurnStrip, { order: control?.turnOrder ?? [] }), draftActive ? (_jsxs(SectionCard, { title: myTurn
                    ? "Jugadores disponibles · elige tu fichaje"
                    : "Jugadores disponibles", icon: Gavel, children: [_jsxs("div", { className: "mb-4 grid gap-2 sm:grid-cols-3", children: [_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx(Label, { htmlFor: "draft-search", className: "text-xs", children: "Buscar" }), _jsxs("div", { className: "relative", children: [_jsx(Search, { "aria-hidden": "true", className: "absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" }), _jsx(Input, { id: "draft-search", value: search, onChange: (event) => setSearch(event.target.value), placeholder: "Nombre, club real, pa\u00EDs\u2026", className: "h-11 pl-9", disabled: !myTurn })] })] }), _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx(Label, { htmlFor: "draft-group", className: "text-xs", children: "Posici\u00F3n" }), _jsxs(Select, { value: group, onValueChange: (value) => setGroup(value), disabled: !myTurn, children: [_jsx(SelectTrigger, { id: "draft-group", className: "h-11", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "todos", children: "Todas" }), _jsx(SelectItem, { value: "GK", children: GROUP_LABEL.GK }), _jsx(SelectItem, { value: "DEF", children: GROUP_LABEL.DEF }), _jsx(SelectItem, { value: "MID", children: GROUP_LABEL.MID }), _jsx(SelectItem, { value: "FWD", children: GROUP_LABEL.FWD })] })] })] }), _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx(Label, { htmlFor: "draft-sort", className: "text-xs", children: "Ordenar por" }), _jsxs(Select, { value: sort, onValueChange: (value) => setSort(value), disabled: !myTurn, children: [_jsx(SelectTrigger, { id: "draft-sort", className: "h-11", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "ovr", children: "Media OVR" }), _jsx(SelectItem, { value: "value", children: "Valor" }), _jsx(SelectItem, { value: "age", children: "Edad" }), _jsx(SelectItem, { value: "name", children: "Nombre" })] })] })] })] }), pool === undefined ? (_jsxs("div", { className: "flex items-center gap-2 py-8 text-sm text-muted-foreground", children: [_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" }), "Cargando jugadores disponibles\u2026"] })) : pool.length === 0 ? (_jsx("p", { className: "py-8 text-sm text-muted-foreground", children: "No hay jugadores que coincidan con la b\u00FAsqueda." })) : (_jsx("ul", { className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-3", children: pool.map((player) => (_jsx("li", { children: _jsx(PoolCard, { player: player, disabled: !myTurn, onSelect: () => setTarget(player) }) }, player.playerId))) })), !myTurn ? (_jsxs("p", { className: "mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground", children: [_jsx(Info, { className: "mt-0.5 size-3.5 shrink-0", "aria-hidden": "true" }), "Los fichajes se habilitan cuando el turno sea tuyo. Mientras tanto puedes seguir el estado del draft y el historial de adquisiciones."] })) : null] })) : null, _jsx(SectionCard, { title: "Historial de adquisiciones", icon: History, bodyClassName: (control?.picks.length ?? 0) === 0 ? undefined : "p-0", children: control === undefined ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "Cargando historial\u2026" })) : !control || control.picks.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "Todav\u00EDa no hay adquisiciones en el draft. Cada fichaje quedar\u00E1 registrado aqu\u00ED con su Presidente, su precio y su ronda." })) : (_jsx("ul", { className: "divide-y", children: control.picks
                        .slice()
                        .reverse()
                        .slice(0, 25)
                        .map((pickRow) => (_jsxs("li", { className: "flex flex-wrap items-center gap-3 px-4 py-3", children: [_jsx("span", { className: "num flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold", children: pickRow.pickNumber }), _jsx(PlayerAvatar, { name: pickRow.playerName, flag: pickRow.flag, group: pickRow.group, size: "sm", photo: pickRow.photo }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("p", { className: "truncate text-sm font-semibold", children: [pickRow.playerName, " ", _jsxs("span", { className: "text-xs font-normal text-muted-foreground", children: [POSITION_LABEL[pickRow.position], " \u00B7 ", pickRow.realClub] })] }), _jsxs("p", { className: "truncate text-[11px] text-muted-foreground", children: ["Ronda ", pickRow.round, " \u00B7 ", pickRow.nickname, " (", pickRow.clubName, ") \u00B7 ", relativeTime(pickRow.pickedAt, now), pickRow.mode === "reserva"
                                                ? " · acuerdo reservado del mercado"
                                                : ""] })] }), _jsx("span", { className: "num text-sm font-bold text-brand", children: formatMoney(pickRow.price) })] }, pickRow.id))) })) }), _jsx(PickDialog, { player: target, open: target !== null, onOpenChange: (open) => {
                    if (!open)
                        setTarget(null);
                }, onConfirm: async (player) => {
                    const result = await pick(player.playerId);
                    if (result)
                        setTarget(null);
                }, busy: busyKey !== null })] }));
}
/** Small "mm:ss" inline countdown for the current turn. */
function CountdownInline({ target, now }) {
    const secondsLeft = Math.max(0, Math.ceil((target - now) / 1000));
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    const urgent = secondsLeft <= 30;
    return (_jsxs("span", { className: cn("num rounded-md px-1.5 py-0.5 text-xs normal-case tracking-normal", urgent
            ? "bg-rose-500/15 font-bold text-rose-700 dark:text-rose-300"
            : "bg-muted font-semibold text-foreground"), children: [String(minutes).padStart(2, "0"), ":", String(seconds).padStart(2, "0"), _jsx("span", { className: "sr-only", children: " restantes en el turno" })] }));
}
/** One candidate in the pool: identity, price and why it can/cannot be picked. */
function PoolCard({ player, disabled, onSelect, }) {
    const blocked = !player.offerable;
    return (_jsxs("button", { type: "button", onClick: onSelect, disabled: disabled, className: cn("flex h-full w-full flex-col gap-2 rounded-xl border bg-card p-3 text-left transition-colors", disabled
            ? "cursor-not-allowed opacity-60"
            : "hover:border-primary/50 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"), children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx(PlayerAvatar, { name: player.name, flag: player.flag, group: player.group, size: "md", photo: player.photo }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate text-sm font-bold", children: player.name }), _jsxs("p", { className: "truncate text-[11px] text-muted-foreground", children: [player.realClub, " \u00B7 ", player.age, " a\u00F1os"] })] }), _jsx("span", { className: "num rounded-lg bg-navy px-2 py-1 text-xs font-bold text-white", children: player.ovr })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(PositionPill, { position: player.position, group: player.group }), _jsxs("span", { className: "num text-xs font-semibold text-muted-foreground", children: ["Precio ", formatMoney(player.price)] })] }), blocked && player.blockedReason ? (_jsxs("p", { className: "flex items-start gap-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-300", children: [_jsx(AlertTriangle, { className: "mt-0.5 size-3 shrink-0", "aria-hidden": "true" }), player.blockedReason] })) : null] }));
}
/** Confirmation with the same checks the server will re-run at pick time. */
function PickDialog({ player, open, onOpenChange, onConfirm, busy, }) {
    const check = useQuery(api.draft.check, player ? { playerId: player.playerId } : "skip");
    const passed = check?.passed ?? false;
    const canConfirm = Boolean(check) && passed && check?.isMyTurn && !busy;
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsx(DialogContent, { className: "max-h-[92vh] overflow-y-auto scroll-thin sm:max-w-lg", children: player ? (_jsxs(_Fragment, { children: [_jsxs(DialogHeader, { children: [_jsxs(DialogTitle, { className: "display text-base", children: ["Fichar a ", player.name] }), _jsxs(DialogDescription, { children: [player.realClub, " \u00B7 ", POSITION_LABEL[player.position], " \u00B7 OVR", " ", player.ovr, " \u00B7 ", player.age, " a\u00F1os"] })] }), _jsxs("div", { className: "flex items-center justify-between gap-3 rounded-xl border bg-gradient-to-br from-navy to-navy-deep p-4 text-white", children: [_jsx(PlayerAvatar, { name: player.name, flag: player.flag, group: player.group, size: "lg", photo: player.photo }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wide text-white/70", children: "Coste del fichaje" }), _jsx("p", { className: "num text-2xl font-bold text-brand-bright", children: formatMoney(player.price) })] })] }), check === undefined ? (_jsxs("p", { className: "flex items-center gap-2 text-sm text-muted-foreground", children: [_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" }), "Comprobando disponibilidad y reglas\u2026"] })) : check === null ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "La comprobaci\u00F3n no est\u00E1 disponible para tu cuenta." })) : check.unavailableReason ? (_jsxs("div", { className: "rounded-xl border border-rose-500/40 bg-rose-500/[0.06] p-4", children: [_jsxs("p", { className: "flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-300", children: [_jsx(AlertTriangle, { className: "size-4", "aria-hidden": "true" }), "Jugador no disponible"] }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: check.unavailableReason })] })) : (_jsxs(_Fragment, { children: [check?.isMyTurn ? null : (_jsxs("p", { className: "flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.06] p-3 text-xs text-amber-800 dark:text-amber-200", children: [_jsx(AlertTriangle, { className: "mt-0.5 size-3.5 shrink-0", "aria-hidden": "true" }), "No es tu turno todav\u00EDa: espera a que te toque para confirmar."] })), _jsx(RuleCheckList, { checks: check.checks, variant: "compact" }), _jsx(Separator, {}), _jsx("p", { className: "text-[11px] leading-relaxed text-muted-foreground", children: "Al confirmar, el precio se descuenta de tu presupuesto y el jugador pasa a tu plantilla. Todo queda registrado en la auditor\u00EDa del torneo." })] })), _jsxs(DialogFooter, { className: "gap-2 sm:gap-0", children: [_jsx(Button, { type: "button", variant: "outline", className: "min-h-11", onClick: () => onOpenChange(false), children: "Cancelar" }), _jsxs(Button, { type: "button", className: "min-h-11", disabled: !canConfirm, onClick: () => {
                                    void onConfirm(player);
                                }, children: [busy ? (_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" })) : (_jsx(Gavel, { className: "size-4", "aria-hidden": "true" })), "Confirmar fichaje \u00B7 ", formatMoney(player.price)] })] })] })) : null }) }));
}
