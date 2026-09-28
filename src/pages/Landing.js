import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { BrandLockup, ElevenMark } from "@/components/eleven/Brand";
import { Crest } from "@/components/eleven/Crest";
import { PlayerAvatar } from "@/components/eleven/PlayerBits";
import { RuleCheckList } from "@/components/eleven/RuleCheckList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accessibility, ArrowRight, Check, ClipboardCheck, Crown, Gauge, Handshake, Layers, Lock, ScanEye, ShieldCheck, Shirt, Sparkles, Trophy, Users, } from "lucide-react";
const FADE_UP = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0 },
};
const PILLARS = [
    {
        icon: ShieldCheck,
        title: "Club",
        description: "Cada Presidente representa un club dentro del torneo: escudo, liga, presupuesto y estado competitivo en una sola pantalla.",
        status: "Disponible",
    },
    {
        icon: Users,
        title: "Plantilla",
        description: "Plantilla completa, vista campo, formación, táctica y situación de cada jugador frente al mercado. El corazón del producto.",
        status: "Disponible",
    },
    {
        icon: Handshake,
        title: "Mercado",
        description: "Jugadores libres, ofertas, trades y acuerdos reservados que se ejecutan al abrirse el draft.",
        status: "Disponible",
    },
    {
        icon: Trophy,
        title: "Competición",
        description: "Calendario ida y vuelta, jornadas, resultados, tabla y Match Center con los puntos fantasy de tu once.",
        status: "Disponible",
    },
];
const FEATURES = [
    {
        icon: Gauge,
        title: "Centro de control, no un portal",
        description: "La Home responde en cinco segundos: qué tengo, qué puedo hacer, qué está ocurriendo y qué viene después.",
    },
    {
        icon: Layers,
        title: "Motor de reglas único",
        description: "Presupuesto, cupos por posición, sub-21, club de origen y cierre de alineación se validan en un solo sitio, en navegador y servidor.",
    },
    {
        icon: Shirt,
        title: "Pizarra sin arrastrar",
        description: "Elige jugador, elige posición y confirma. El flujo funciona con teclado y lectores de pantalla, y también con ratón.",
    },
    {
        icon: ScanEye,
        title: "Transparencia de reglas",
        description: "Si una acción no es posible, el sistema explica la regla, las cifras y la alternativa. Nunca un error sin explicación humana.",
    },
    {
        icon: Crown,
        title: "Roles reales",
        description: "Ser Administrador es un permiso dentro del torneo. Puedes presidir un club y administrar el torneo con la misma cuenta.",
    },
    {
        icon: Sparkles,
        title: "Datos FC 27 versionados",
        description: "Importamos y normalizamos la base pública de ratings con su snapshot, para que el torneo sepa siempre qué versión usa.",
    },
];
const FLOW = [
    {
        step: "01",
        title: "Elige tu club",
        description: "Explora más de 100 equipos de Premier League, LaLiga, Serie A, Bundesliga, Ligue 1 y más. Elige el que quieras presidir.",
    },
    {
        step: "02",
        title: "Únete a tu liga",
        description: "Crea una liga con reglas a tu medida o únete a una existente con código de invitación.",
    },
    {
        step: "03",
        title: "Construye en el draft",
        description: "Todos los equipos arrancan vacíos. Fichas del catálogo FC 27 en turnos cronometrados con validación de reglas en vivo.",
    },
    {
        step: "04",
        title: "Gestiona el mercado",
        description: "Ofertas, trades, negociaciones y acuerdos reservados. El motor valida presupuesto y cupos en cada operación.",
    },
    {
        step: "05",
        title: "Compite en la tabla",
        description: "Calendario ida y vuelta, jornadas, resultados fantasy y Match Center con los puntos de tu once titular.",
    },
];
const ACCESSIBILITY = [
    "Foco visible y no oculto en cada acción crítica",
    "Objetivos táctiles de 44 px o más",
    "Alternativa a arrastrar y soltar en la pizarra",
    "Estado comunicado con icono, texto y color",
    "Errores explicados con la regla y la cifra exacta",
];
const DEMO_CHECKS = [
    {
        id: "demo-size",
        ruleRef: "R-02 · Tamaño de plantilla",
        label: "Tamaño de plantilla",
        value: "20 / 20",
        passed: true,
        detail: "Tu plantilla respeta el máximo y quedan 0 plazas para el mercado.",
    },
    {
        id: "demo-group",
        ruleRef: "R-06 · Delanteros",
        label: "Delanteros",
        value: "6 / 6-8",
        passed: true,
        detail: "Cumples el rango de delanteros (6-8).",
    },
    {
        id: "demo-club",
        ruleRef: "R-07 · Jugadores por club real",
        label: "Jugadores por club real",
        value: "3 / 3",
        passed: true,
        detail: "Ningún club de origen aporta más de 3 jugadores a tu plantilla.",
    },
    {
        id: "demo-lineup",
        ruleRef: "Alineación · Posición natural",
        label: "Posiciones compatibles",
        value: "1 error",
        passed: false,
        detail: "Benjamin Pavard (DFC) no puede ocupar la posición ED de la formación 4-2-3-1.",
    },
];
const DEMO_XI = [
    { name: "Marc-André ter Stegen", position: "POR", ovr: 85, group: "GK", flag: "🇩🇪" },
    { name: "Jules Koundé", position: "LD", ovr: 85, group: "DEF", flag: "🇫🇷" },
    { name: "Pau Cubarsí", position: "DFC", ovr: 82, group: "DEF", flag: "🇪🇸" },
    { name: "Ronald Araújo", position: "DFC", ovr: 84, group: "DEF", flag: "🇺🇾" },
    { name: "Alejandro Balde", position: "LI", ovr: 83, group: "DEF", flag: "🇪🇸" },
    { name: "Frenkie de Jong", position: "MCD", ovr: 86, group: "MID", flag: "🇳🇱" },
    { name: "Pedri", position: "MC", ovr: 88, group: "MID", flag: "🇪🇸" },
    { name: "Lamine Yamal", position: "ED", ovr: 89, group: "FWD", flag: "🇪🇸" },
    { name: "Dani Olmo", position: "MCO", ovr: 85, group: "MID", flag: "🇪🇸" },
    { name: "Raphinha", position: "EI", ovr: 87, group: "FWD", flag: "🇧🇷" },
    { name: "Robert Lewandowski", position: "DC", ovr: 87, group: "FWD", flag: "🇵🇱" },
];
function Reveal({ children, className, delay = 0, }) {
    return (_jsx(motion.div, { variants: FADE_UP, initial: "hidden", whileInView: "show", viewport: { once: true, margin: "-80px" }, transition: { duration: 0.5, delay, ease: "easeOut" }, className: className, children: children }));
}
export default function Landing() {
    return (_jsxs("div", { className: "min-h-screen bg-navy-deep text-white", children: [_jsx("header", { className: "sticky top-0 z-40 border-b border-white/10 bg-navy-deep/85 backdrop-blur", children: _jsxs("div", { className: "mx-auto flex min-h-16 w-full max-w-7xl items-center gap-4 px-4 lg:px-8", children: [_jsx(Link, { to: "/", className: "rounded-lg", children: _jsx(BrandLockup, {}) }), _jsx("nav", { "aria-label": "Secciones", className: "ml-auto hidden items-center gap-1 lg:flex", children: [
                                ["Producto", "#producto"],
                                ["Pilares", "#pilares"],
                                ["Roles", "#roles"],
                                ["Reglas", "#reglas"],
                                ["Accesibilidad", "#accesibilidad"],
                            ].map(([label, href]) => (_jsx("a", { href: href, className: "min-h-11 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white", children: label }, href))) }), _jsxs("div", { className: "ml-auto flex items-center gap-2 lg:ml-0", children: [_jsx(Button, { asChild: true, variant: "ghost", className: "min-h-11 text-white hover:bg-white/10 hover:text-white", children: _jsx(Link, { to: "/auth?returnTo=%2Fdashboard", children: "Entrar" }) }), _jsx(Button, { asChild: true, className: "min-h-11", children: _jsxs(Link, { to: "/auth?returnTo=%2Fdashboard", children: ["Crear mi club", _jsx(ArrowRight, { className: "size-4", "aria-hidden": "true" })] }) })] })] }) }), _jsxs("section", { className: "relative overflow-hidden", children: [_jsx("div", { "aria-hidden": "true", className: "pointer-events-none absolute inset-0 opacity-[0.55]", style: {
                            backgroundImage: "radial-gradient(60% 50% at 15% 0%, rgba(47,107,255,0.42) 0%, transparent 60%), radial-gradient(45% 45% at 85% 10%, rgba(31,157,85,0.32) 0%, transparent 65%)",
                        } }), _jsxs("div", { className: "relative mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-24", children: [_jsx("div", { children: _jsxs(motion.div, { variants: FADE_UP, initial: "hidden", animate: "show", transition: { duration: 0.5 }, children: [_jsxs(Badge, { className: "border-white/15 bg-white/10 text-white/85", children: [_jsx(Trophy, { className: "size-3.5", "aria-hidden": "true" }), "Temporada 2025 / 2026 \u00B7 Liga 11Eleven Foundation"] }), _jsxs("h1", { className: "display mt-6 text-4xl leading-[1.02] sm:text-5xl lg:text-6xl", children: ["M\u00E1s que un jugador,", _jsx("br", {}), _jsx("span", { className: "text-brand-bright", children: "una liga de Presidentes." })] }), _jsx("p", { className: "mt-5 max-w-xl text-base leading-relaxed text-white/70", children: "11Eleven es la plataforma para presidir un club de f\u00FAtbol fantasy con acceso a m\u00E1s de 100 equipos de las ligas m\u00E1s importantes del mundo. Elige tu club, arma tu plantilla en el draft y compite con reglas verificadas por un motor que sabe qu\u00E9 puedes hacer, qu\u00E9 no y por qu\u00E9." }), _jsxs("div", { className: "mt-8 flex flex-wrap items-center gap-3", children: [_jsx(Button, { asChild: true, size: "lg", className: "min-h-12 px-6 text-sm", children: _jsxs(Link, { to: "/auth?returnTo=%2Fdashboard", children: ["Entrar al centro de control", _jsx(ArrowRight, { className: "size-4", "aria-hidden": "true" })] }) }), _jsx(Button, { asChild: true, size: "lg", variant: "outline", className: "min-h-12 border-white/20 bg-white/5 px-6 text-sm text-white hover:bg-white/10 hover:text-white", children: _jsx("a", { href: "#producto", children: "Ver c\u00F3mo funciona" }) })] }), _jsx("dl", { className: "mt-10 grid max-w-lg grid-cols-2 gap-4 sm:grid-cols-4", children: [
                                                ["100+", "Equipos del mundo"],
                                                ["15+", "Ligas disponibles"],
                                                ["10", "Reglas del motor"],
                                                ["AA", "WCAG 2.2"],
                                            ].map(([value, label]) => (_jsxs("div", { className: "rounded-xl border border-white/10 bg-white/[0.04] p-3", children: [_jsx("dt", { className: "num display text-xl text-white", children: value }), _jsx("dd", { className: "text-[11px] font-semibold uppercase tracking-wide text-white/55", children: label })] }, label))) })] }) }), _jsxs(motion.div, { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: 0.15 }, className: "relative", children: [_jsxs("div", { className: "rounded-2xl border border-white/12 bg-card p-4 text-foreground shadow-2xl", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Crest, { name: "FC Barcelona", shortName: "BAR", colors: ["#A50044", "#004D98"], size: "md" }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "display truncate text-sm", children: "FC Barcelona" }), _jsx("p", { className: "truncate text-[11px] text-muted-foreground", children: "LaLiga \u00B7 @Ricardo \u00B7 Jornada 12" })] }), _jsxs("span", { className: "ml-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300", children: [_jsx("span", { "aria-hidden": "true", className: "size-2 rounded-full bg-emerald-500" }), "Competici\u00F3n"] })] }), _jsx("dl", { className: "num mt-4 grid grid-cols-4 gap-2 text-center", children: [
                                                    ["20/20", "Plantilla"],
                                                    ["€892.5M", "Valor"],
                                                    ["83", "OVR"],
                                                    ["4-2-3-1", "Once"],
                                                ].map(([value, label]) => (_jsxs("div", { className: "rounded-lg border bg-muted/40 px-2 py-2", children: [_jsx("dt", { className: "display text-sm", children: value }), _jsx("dd", { className: "text-[10px] uppercase tracking-wide text-muted-foreground", children: label })] }, label))) }), _jsx("div", { className: "pitch-surface mt-4 grid grid-cols-4 gap-2 rounded-xl p-3", children: DEMO_XI.map((player) => (_jsxs("div", { className: "flex flex-col items-center gap-1", children: [_jsx(PlayerAvatar, { name: player.name, flag: player.flag, group: player.group, size: "xs" }), _jsx("span", { className: "num rounded bg-white/90 px-1 text-[10px] font-bold text-slate-900", children: player.ovr }), _jsx("span", { className: "text-[9px] font-semibold uppercase tracking-wide text-white/80", children: player.position })] }, player.name))) }), _jsxs("div", { className: "mt-4", children: [_jsxs("p", { className: "mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground", children: [_jsx(ClipboardCheck, { className: "size-3.5", "aria-hidden": "true" }), "Validaci\u00F3n del motor de reglas"] }), _jsx(RuleCheckList, { checks: DEMO_CHECKS.slice(0, 2) })] })] }), _jsxs("div", { className: "pointer-events-none absolute -bottom-6 -right-2 hidden w-64 rounded-xl border border-white/12 bg-navy/90 p-3 text-xs text-white/80 shadow-xl sm:block", children: [_jsxs("p", { className: "flex items-center gap-2 font-semibold text-white", children: [_jsx(Lock, { className: "size-3.5", "aria-hidden": "true" }), "Operaci\u00F3n bloqueada"] }), _jsx("p", { className: "mt-1 leading-snug", children: "Tu plantilla es de 20/20 jugadores: libera una plaza para inscribir a otro. Regla R-02." })] })] })] })] }), _jsx("section", { id: "producto", className: "border-t border-white/10 bg-navy/60", children: _jsxs("div", { className: "mx-auto w-full max-w-7xl px-4 py-16 lg:px-8 lg:py-20", children: [_jsxs(Reveal, { className: "max-w-3xl", children: [_jsx("p", { className: "display text-xs tracking-[0.22em] text-brand-bright", children: "El problema que resolvemos" }), _jsx("h2", { className: "display mt-3 text-3xl leading-tight sm:text-4xl", children: "Un torneo fantasy se rompe cuando nadie sabe qu\u00E9 est\u00E1 permitido." }), _jsx("p", { className: "mt-4 text-sm leading-relaxed text-white/70", children: "La mayor\u00EDa de plataformas empiezan por noticias y chat. Aqu\u00ED empezamos por lo que un Presidente necesita saber: c\u00F3mo est\u00E1 mi equipo, qu\u00E9 puedo hacer ahora, qu\u00E9 est\u00E1 pasando en el torneo y qu\u00E9 viene despu\u00E9s. Todo lo dem\u00E1s apoya esos cuatro pilares." })] }), _jsx(Reveal, { className: "mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4", children: FEATURES.map((feature) => (_jsxs("div", { className: "flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5", children: [_jsx("span", { "aria-hidden": "true", className: "flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-bright/70 text-white", children: _jsx(feature.icon, { className: "size-5" }) }), _jsx("h3", { className: "text-sm font-bold text-white", children: feature.title }), _jsx("p", { className: "text-xs leading-relaxed text-white/65", children: feature.description })] }, feature.title))) })] }) }), _jsx("section", { id: "pilares", className: "border-t border-white/10", children: _jsxs("div", { className: "mx-auto w-full max-w-7xl px-4 py-16 lg:px-8 lg:py-20", children: [_jsx(Reveal, { className: "flex flex-wrap items-end justify-between gap-4", children: _jsxs("div", { className: "max-w-2xl", children: [_jsx("p", { className: "display text-xs tracking-[0.22em] text-brand-bright", children: "Arquitectura de producto" }), _jsx("h2", { className: "display mt-3 text-3xl leading-tight sm:text-4xl", children: "Club \u2192 Plantilla \u2192 Mercado \u2192 Competici\u00F3n" }), _jsx("p", { className: "mt-4 text-sm leading-relaxed text-white/70", children: "Los cuatro pilares ya est\u00E1n vivos sobre el mismo Tournament Engine: cada uno consulta el mismo motor de reglas, la misma base de jugadores y el mismo registro de auditor\u00EDa." })] }) }), _jsx("div", { className: "mt-10 grid gap-4 lg:grid-cols-4", children: PILLARS.map((pillar, index) => (_jsx(Reveal, { delay: index * 0.06, children: _jsxs("div", { className: "flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-5", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { "aria-hidden": "true", className: "flex size-10 items-center justify-center rounded-xl bg-white/10 text-white", children: _jsx(pillar.icon, { className: "size-5" }) }), _jsx("span", { className: pillar.status === "Disponible"
                                                        ? "rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300"
                                                        : "rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/55", children: pillar.status })] }), _jsx("h3", { className: "display text-lg", children: pillar.title }), _jsx("p", { className: "text-xs leading-relaxed text-white/65", children: pillar.description })] }) }, pillar.title))) })] }) }), _jsx("section", { id: "roles", className: "border-t border-white/10 bg-navy/60", children: _jsxs("div", { className: "mx-auto grid w-full max-w-7xl gap-8 px-4 py-16 lg:grid-cols-2 lg:px-8 lg:py-20", children: [_jsxs(Reveal, { children: [_jsx("p", { className: "display text-xs tracking-[0.22em] text-brand-bright", children: "Roles" }), _jsx("h2", { className: "display mt-3 text-3xl leading-tight sm:text-4xl", children: "Una cuenta, dos sombreros" }), _jsxs("p", { className: "mt-4 text-sm leading-relaxed text-white/70", children: ["Separamos estrictamente ", _jsx("strong", { className: "text-white", children: "persona" }), ",", " ", _jsx("strong", { className: "text-white", children: "presidencia" }), " y", " ", _jsx("strong", { className: "text-white", children: "rol administrativo" }), ". Tu cuenta puede presidir distintos clubes en torneos distintos, y administrar uno de ellos sin cambiar de usuario."] }), _jsx("div", { className: "mt-8 flex flex-col gap-3", children: [
                                        {
                                            icon: ShieldCheck,
                                            title: "Presidente",
                                            description: "Gestiona su club: plantilla, once titular, táctica y situación de cada jugador frente al mercado.",
                                        },
                                        {
                                            icon: Crown,
                                            title: "Administrador",
                                            description: "Define reglas, presupuestos, cupos y fases del torneo, y consulta la auditoría completa de operaciones.",
                                        },
                                        {
                                            icon: Accessibility,
                                            title: "El árbitro invisible",
                                            description: "El sistema permite negociar y experimentar, pero impide acciones inválidas explicando la regla exacta.",
                                        },
                                    ].map((role) => (_jsxs("div", { className: "flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4", children: [_jsx("span", { "aria-hidden": "true", className: "flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10", children: _jsx(role.icon, { className: "size-4" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-bold", children: role.title }), _jsx("p", { className: "mt-0.5 text-xs leading-relaxed text-white/65", children: role.description })] })] }, role.title))) })] }), _jsx(Reveal, { delay: 0.1, children: _jsxs("div", { className: "rounded-2xl border border-white/12 bg-card p-5 text-foreground", children: [_jsx("p", { className: "display text-sm", children: "Matriz de permisos" }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: "El rol administrativo se compone de permisos por \u00E1rea, as\u00ED puedes tener un administrador de mercado o de calendario sin cambiar la arquitectura." }), _jsx("ul", { className: "mt-4 grid grid-cols-2 gap-2", children: [
                                            "Configuración",
                                            "Presidentes",
                                            "Jugadores",
                                            "Mercado",
                                            "Draft",
                                            "Calendario",
                                            "Noticias",
                                            "Auditoría",
                                        ].map((permission) => (_jsxs("li", { className: "flex min-h-11 items-center gap-2 rounded-lg border bg-muted/40 px-3 text-xs font-semibold", children: [_jsx(ShieldCheck, { className: "size-3.5 text-primary", "aria-hidden": "true" }), permission] }, permission))) }), _jsx("div", { className: "mt-4 rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground", children: "La Administraci\u00F3n incluye torneo, reglas, presidentes, roles, mercado, draft, jornadas y auditor\u00EDa operativa sobre clubes y plantillas." })] }) })] }) }), _jsx("section", { id: "reglas", className: "border-t border-white/10", children: _jsxs("div", { className: "mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 lg:grid-cols-2 lg:px-8 lg:py-20", children: [_jsxs(Reveal, { children: [_jsx("p", { className: "display text-xs tracking-[0.22em] text-brand-bright", children: "Motor de reglas" }), _jsx("h2", { className: "display mt-3 text-3xl leading-tight sm:text-4xl", children: "Una sola verdad para todo el torneo" }), _jsx("p", { className: "mt-4 text-sm leading-relaxed text-white/70", children: "Ninguna pantalla valida por su cuenta. Todas consultan el mismo motor, tanto en el navegador (validaci\u00F3n en vivo) como en el servidor (verdad final). Si algo cambia mientras editas, la operaci\u00F3n se rechaza con la explicaci\u00F3n exacta." }), _jsxs("div", { className: "mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4", children: [_jsx("p", { className: "text-xs font-bold uppercase tracking-wide text-white/55", children: "Ejemplo de bloqueo explicado" }), _jsx("p", { className: "mt-2 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-xs leading-relaxed text-rose-100", children: "No puedes completar esta operaci\u00F3n porque tu plantilla ya tiene 3 jugadores pertenecientes a este club de origen (Regla R-07). Libera una plaza o elige otro jugador." }), _jsx("p", { className: "mt-3 text-[11px] text-white/55", children: "Nunca ver\u00E1s un \u00ABerror 409\u00BB: ver\u00E1s qu\u00E9 regla se incumple, con qu\u00E9 cifras y qu\u00E9 alternativa tienes." })] })] }), _jsx(Reveal, { delay: 0.1, children: _jsxs("div", { className: "rounded-2xl border border-white/12 bg-card p-5 text-foreground", children: [_jsx("p", { className: "display text-sm", children: "Reglamento aplicado a tu club" }), _jsx("div", { className: "mt-3", children: _jsx(RuleCheckList, { checks: DEMO_CHECKS, variant: "full" }) })] }) })] }) }), _jsx("section", { className: "border-t border-white/10 bg-navy/60", children: _jsxs("div", { className: "mx-auto w-full max-w-7xl px-4 py-16 lg:px-8 lg:py-20", children: [_jsxs(Reveal, { className: "max-w-2xl", children: [_jsx("p", { className: "display text-xs tracking-[0.22em] text-brand-bright", children: "Flujo del Presidente" }), _jsx("h2", { className: "display mt-3 text-3xl leading-tight sm:text-4xl", children: "De la invitaci\u00F3n al once titular" })] }), _jsx("ol", { className: "mt-10 grid gap-4 lg:grid-cols-5", children: FLOW.map((item, index) => (_jsx(Reveal, { delay: index * 0.05, children: _jsxs("li", { className: "flex h-full flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4", children: [_jsx("span", { className: "num display text-2xl text-white/25", children: item.step }), _jsx("p", { className: "text-sm font-bold text-white", children: item.title }), _jsx("p", { className: "text-xs leading-relaxed text-white/65", children: item.description })] }) }, item.step))) })] }) }), _jsx("section", { id: "accesibilidad", className: "border-t border-white/10", children: _jsxs("div", { className: "mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-20", children: [_jsxs(Reveal, { children: [_jsx("p", { className: "display text-xs tracking-[0.22em] text-brand-bright", children: "Accesibilidad" }), _jsx("h2", { className: "display mt-3 text-3xl leading-tight sm:text-4xl", children: "WCAG 2.2 AA desde el primer dise\u00F1o" }), _jsx("p", { className: "mt-4 text-sm leading-relaxed text-white/70", children: "Los criterios de accesibilidad no son una revisi\u00F3n posterior: son una l\u00EDnea base de dise\u00F1o del producto. Especialmente en la pizarra, donde la mayor\u00EDa de plataformas funcionan solo arrastrando." })] }), _jsx(Reveal, { delay: 0.1, children: _jsx("ul", { className: "grid gap-3 sm:grid-cols-2", children: ACCESSIBILITY.map((item) => (_jsxs("li", { className: "flex min-h-12 items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-xs leading-relaxed text-white/75", children: [_jsx(Check, { className: "mt-0.5 size-4 shrink-0 text-brand-bright", "aria-hidden": "true" }), item] }, item))) }) })] }) }), _jsx("section", { className: "border-t border-white/10 bg-gradient-to-br from-brand/25 via-navy-deep to-pitch/20", children: _jsxs("div", { className: "mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-4 py-16 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-20", children: [_jsxs(Reveal, { children: ["              ", _jsx("h2", { className: "display max-w-2xl text-3xl leading-tight sm:text-4xl", children: "Tu club est\u00E1 esperando Presidente" }), _jsx("p", { className: "mt-3 max-w-xl text-sm leading-relaxed text-white/75", children: "Entra, elige entre m\u00E1s de 100 equipos de las principales ligas del mundo, crea tu liga con reglas personalizadas y gestiona la plantilla desde el primer draft. Si eres el primer Presidente del torneo, adem\u00E1s quedas como Administrador principal." })] }), _jsx(Reveal, { delay: 0.1, children: _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsx(Button, { asChild: true, size: "lg", className: "min-h-12 px-6 text-sm", children: _jsxs(Link, { to: "/auth?returnTo=%2Fdashboard", children: ["Crear mi club", _jsx(ArrowRight, { className: "size-4", "aria-hidden": "true" })] }) }), _jsx(Button, { asChild: true, size: "lg", variant: "outline", className: "min-h-12 border-white/25 bg-white/5 px-6 text-sm text-white hover:bg-white/10 hover:text-white", children: _jsx(Link, { to: "/auth?returnTo=%2Fdashboard", children: "Ya tengo cuenta" }) })] }) })] }) }), _jsx("footer", { className: "border-t border-white/10 bg-navy-deep", children: _jsxs("div", { className: "mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 lg:flex-row lg:items-center lg:justify-between lg:px-8", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(ElevenMark, { className: "size-9" }), _jsxs("div", { children: [_jsx("p", { className: "display text-sm", children: "11Eleven" }), _jsx("p", { className: "text-[11px] text-white/55", children: "Fantasy Football Manager \u00B7 Temporada 2025 / 2026" })] })] }), _jsxs("nav", { "aria-label": "Enlaces del pie", className: "flex flex-wrap gap-4 text-xs text-white/60", children: [_jsx("a", { className: "hover:text-white", href: "#producto", children: "Producto" }), _jsx("a", { className: "hover:text-white", href: "#roles", children: "Roles" }), _jsx("a", { className: "hover:text-white", href: "#reglas", children: "Reglas" }), _jsx(Link, { className: "hover:text-white", to: "/auth?returnTo=%2Fdashboard", children: "Entrar" })] }), _jsx("p", { className: "text-[11px] text-white/45", children: "Datos de jugadores basados en snapshots p\u00FAblicos de ratings (EA SPORTS FC 27 y SoFIFA) normalizados por la plataforma." })] }) })] }));
}
