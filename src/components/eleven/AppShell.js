import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { TOURNAMENT_STATUS_META } from "@/convex/rulesEngine";
import { useAuth } from "@/hooks/use-auth";
import { BrandLockup, ElevenMark } from "./Brand";
import { Crest } from "./Crest";
import { LeagueManagerDialog } from "./LeagueManager";
import { Countdown, StatusPill, ToneDot } from "./SectionCard";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { BookOpen, ClipboardList, Gauge, Handshake, LayoutDashboard, LogOut, Menu, Shield, Shirt, ShoppingBag, Swords, Trophy, User, Users, UsersRound, Zap, } from "lucide-react";
const NAV_GROUPS = [
    {
        title: "Control",
        items: [
            { label: "Inicio", to: "/dashboard", icon: LayoutDashboard, end: true },
            { label: "Mi Club", to: "/dashboard/club", icon: Shield, end: true },
        ],
    },
    {
        title: "Plantilla",
        items: [
            { label: "Plantilla", to: "/dashboard/club/plantilla", icon: Users },
            { label: "Formación", to: "/dashboard/formacion", icon: Shirt },
            { label: "Estado de jugadores", to: "/dashboard/club/estado", icon: ClipboardList },
        ],
    },
    {
        title: "Mercado y Draft",
        items: [
            { label: "Mercado", to: "/dashboard/mercado", icon: ShoppingBag, end: true },
            {
                label: "Negociaciones",
                to: "/dashboard/mercado/negociaciones",
                icon: Handshake,
            },
            { label: "Draft", to: "/dashboard/draft", icon: Zap },
        ],
    },
    {
        title: "Torneo",
        items: [
            { label: "Resultados", to: "/dashboard/competicion", icon: Swords },
            { label: "Equipos", to: "/dashboard/equipos", icon: UsersRound },
            { label: "Reglas del torneo", to: "/dashboard/reglas", icon: BookOpen },
            { label: "Administración", to: "/dashboard/admin", icon: Gauge, adminOnly: true },
            { label: "Perfil", to: "/dashboard/perfil", icon: User },
        ],
    },
];
const MOBILE_NAV = [
    { label: "Inicio", to: "/dashboard", icon: LayoutDashboard, end: true },
    { label: "Club", to: "/dashboard/club", icon: Shield, end: true },
    { label: "Mercado", to: "/dashboard/mercado", icon: ShoppingBag, end: true },
    { label: "Equipos", to: "/dashboard/equipos", icon: UsersRound },
    { label: "Draft", to: "/dashboard/draft", icon: Zap },
];
function navLinkClass({ isActive }) {
    return cn("flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors", isActive
        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground");
}
function UserMenu({ state, variant = "bar", }) {
    const { signOut } = useAuth();
    const navigate = useNavigate();
    const [leaguesOpen, setLeaguesOpen] = useState(false);
    const [brokenImage, setBrokenImage] = useState(null);
    const photo = state.user.image;
    const initials = state.user.name
        .split(/\s+/)
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    const handleSignOut = async () => {
        await signOut();
        navigate("/");
    };
    return (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs("button", { type: "button", className: cn("flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-left transition-colors", variant === "bar"
                        ? "hover:bg-accent"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"), children: [photo && brokenImage !== photo ? (_jsx("img", { src: photo, alt: "", onError: () => setBrokenImage(photo), className: "size-9 rounded-full object-cover ring-1 ring-gold/40" }, photo)) : (_jsx("span", { className: "display flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-brand to-navy text-sm font-bold text-white", children: initials || "P" })), _jsxs("span", { className: "hidden flex-col leading-tight sm:flex", children: [_jsx("span", { className: "truncate text-sm font-semibold", children: state.user.name }), _jsxs("span", { className: "truncate text-[11px] text-muted-foreground", children: [state.president?.nickname ?? state.user.nickname, " \u00B7", " ", state.isAdmin ? "Administrador" : "Presidente"] })] })] }) }), _jsxs(DropdownMenuContent, { align: "end", className: "w-60", children: [_jsxs(DropdownMenuLabel, { children: [_jsx("span", { className: "block text-sm font-semibold", children: state.user.name }), _jsx("span", { className: "block text-xs font-normal text-muted-foreground", children: state.user.email || "Cuenta sin correo" })] }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onClick: () => navigate("/dashboard/perfil"), children: [_jsx(User, { className: "mr-2 size-4", "aria-hidden": "true" }), "Mi perfil"] }), _jsxs(DropdownMenuItem, { onClick: () => navigate("/dashboard/reglas"), children: [_jsx(BookOpen, { className: "mr-2 size-4", "aria-hidden": "true" }), "Reglas del torneo"] }), _jsxs(DropdownMenuItem, { onClick: () => setLeaguesOpen(true), children: [_jsx(Trophy, { className: "mr-2 size-4", "aria-hidden": "true" }), "Mis ligas"] }), state.isAdmin ? (_jsxs(DropdownMenuItem, { onClick: () => navigate("/dashboard/admin"), children: [_jsx(Gauge, { className: "mr-2 size-4", "aria-hidden": "true" }), "Administraci\u00F3n"] })) : null, _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onClick: handleSignOut, className: "text-destructive", children: [_jsx(LogOut, { className: "mr-2 size-4", "aria-hidden": "true" }), "Cerrar sesi\u00F3n"] })] }), _jsx(LeagueManagerDialog, { open: leaguesOpen, onOpenChange: setLeaguesOpen, leagues: state.leagues })] }));
}
function MoreSheet({ state }) {
    const [open, setOpen] = useState(false);
    const items = NAV_GROUPS.flatMap((group) => group.items).filter((item) => !item.adminOnly || state.isAdmin);
    return (_jsxs(Sheet, { open: open, onOpenChange: setOpen, children: [_jsx(SheetTrigger, { asChild: true, children: _jsxs("button", { type: "button", className: "flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold text-muted-foreground", children: [_jsx(Menu, { className: "size-5", "aria-hidden": "true" }), "M\u00E1s"] }) }), _jsxs(SheetContent, { side: "bottom", className: "pb-8", children: [_jsxs(SheetHeader, { children: [_jsx(SheetTitle, { className: "display text-sm", children: "Navegaci\u00F3n" }), _jsxs(SheetDescription, { children: [state.president?.clubName ?? state.tournament?.name ?? "Torneo", " \u00B7", " ", state.tournament?.season] })] }), _jsxs("nav", { className: "flex flex-col gap-1 px-4", children: [items.map((item) => (_jsxs(NavLink, { to: item.to, end: item.end, onClick: () => setOpen(false), className: ({ isActive }) => cn("flex min-h-12 items-center gap-3 rounded-lg border px-3 text-sm font-semibold", isActive ? "border-primary bg-primary/5 text-primary" : "border-border"), children: [_jsx(item.icon, { className: "size-4", "aria-hidden": "true" }), item.label] }, item.to))), _jsx("div", { className: "mt-2 border-t pt-3", children: _jsx(UserMenu, { state: state }) })] })] })] }));
}
export function AppShell({ state, children, }) {
    const tournament = state.tournament;
    const statusMeta = tournament ? TOURNAMENT_STATUS_META[tournament.status] : null;
    const lockAt = state.nextEvent?.lockAt ?? null;
    return (_jsxs("div", { className: "min-h-screen bg-background lg:flex", children: [_jsxs("aside", { className: "rail-surface sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/5 px-3 py-5 lg:flex", children: [_jsx("div", { className: "px-1", children: _jsx(BrandLockup, {}) }), state.club ? (_jsxs("div", { className: "mt-5 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3", children: [_jsx(Crest, { name: state.club.name, shortName: state.club.shortName, colors: [state.club.colorPrimary, state.club.colorSecondary], size: "md" }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-sm font-bold text-white", children: state.club.name }), _jsxs("p", { className: "truncate text-[11px] text-white/60", children: [state.president?.nickname, " \u00B7 ", state.club.league] })] })] })) : null, _jsx("nav", { className: "scroll-thin mt-5 flex-1 overflow-y-auto pr-1", children: NAV_GROUPS.map((group) => {
                            const items = group.items.filter((item) => !item.adminOnly || state.isAdmin);
                            if (items.length === 0)
                                return null;
                            return (_jsxs("div", { className: "mb-4", children: [_jsx("p", { className: "px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40", children: group.title }), _jsx("div", { className: "flex flex-col gap-0.5", children: items.map((item) => (_jsxs(NavLink, { to: item.to, end: item.end, className: navLinkClass, children: [_jsx(item.icon, { className: "size-4 shrink-0", "aria-hidden": "true" }), _jsx("span", { className: "truncate", children: item.label })] }, item.to))) })] }, group.title));
                        }) }), _jsxs("div", { className: "mt-4 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-brand/30 via-transparent to-pitch/25 p-3.5", children: [_jsxs("p", { className: "display text-sm leading-tight text-white", children: ["M\u00E1s que un jugador,", _jsx("br", {}), "una liga de Presidentes."] }), _jsxs("p", { className: "mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55", children: ["11Eleven \u00B7 ", tournament?.season ?? "Temporada"] })] })] }), _jsxs("div", { className: "flex min-w-0 flex-1 flex-col", children: [_jsx("header", { className: "sticky top-0 z-30 border-b bg-background/90 backdrop-blur", children: _jsxs("div", { className: "flex min-h-16 items-center gap-3 px-4 lg:px-6", children: [_jsxs("div", { className: "flex items-center gap-2.5 lg:hidden", children: [_jsx(ElevenMark, { className: "size-8" }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-sm font-bold", children: state.club?.name ?? "11Eleven" }), _jsx("p", { className: "truncate text-[11px] text-muted-foreground", children: state.president?.nickname ?? state.user.nickname })] })] }), _jsxs("div", { className: "hidden min-w-0 flex-1 items-center gap-3 lg:flex", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "display truncate text-sm", children: tournament?.name }), _jsxs("p", { className: "truncate text-[11px] text-muted-foreground", children: [tournament?.season, " \u00B7 Jornada ", tournament?.currentMatchday, " de", " ", tournament?.totalMatchdays] })] }), statusMeta ? (_jsxs(StatusPill, { className: statusMeta.className, children: [_jsx(ToneDot, { tone: statusMeta.tone }), statusMeta.label] })) : null] }), _jsxs("div", { className: "ml-auto flex items-center gap-2", children: [lockAt ? (_jsxs("span", { className: "hidden items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-[11px] md:inline-flex", children: [_jsx("span", { className: "font-semibold uppercase tracking-wide text-muted-foreground", children: "Cierre de alineaci\u00F3n" }), _jsx(Countdown, { target: lockAt, label: "", className: "text-xs", compact: true })] })) : null, _jsx(UserMenu, { state: state })] })] }) }), _jsx("main", { className: "min-w-0 flex-1 px-4 pb-28 pt-4 lg:px-6 lg:pb-8", children: children })] }), _jsxs("nav", { "aria-label": "Navegaci\u00F3n principal", className: "fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-1 border-t bg-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur lg:hidden", children: [MOBILE_NAV.map((item) => (_jsxs(NavLink, { to: item.to, end: item.end, className: ({ isActive }) => cn("flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold", isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"), children: [_jsx(item.icon, { className: "size-5", "aria-hidden": "true" }), item.label] }, item.to))), _jsx(MoreSheet, { state: state })] })] }));
}
export function AppLoading() {
    return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-navy-deep", children: _jsxs("div", { className: "flex flex-col items-center gap-3 text-white/70", children: [_jsx(ElevenMark, { className: "size-12 animate-pulse" }), _jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.2em]", children: "Cargando el centro de control" })] }) }));
}
export function AppError({ title, description, action, }) {
    return (_jsx("div", { className: "flex min-h-[60vh] items-center justify-center px-4", children: _jsxs("div", { className: "max-w-md text-center", children: [_jsx("p", { className: "display text-lg", children: title }), _jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: description }), action ? _jsx("div", { className: "mt-4 flex justify-center", children: action }) : null] }) }));
}
