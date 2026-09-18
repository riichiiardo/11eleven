import { Link } from "react-router";
import { motion } from "framer-motion";
import { BrandLockup, ElevenMark } from "@/components/eleven/Brand";
import { Crest } from "@/components/eleven/Crest";
import { PlayerAvatar } from "@/components/eleven/PlayerBits";
import { RuleCheckList } from "@/components/eleven/RuleCheckList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RuleCheck } from "@/convex/rulesEngine";
import {
  Accessibility,
  ArrowRight,
  Check,
  ClipboardCheck,
  Crown,
  Gauge,
  Handshake,
  Layers,
  Lock,
  ScanEye,
  ShieldCheck,
  Shirt,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

const FADE_UP = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

const PILLARS = [
  {
    icon: ShieldCheck,
    title: "Club",
    description:
      "Cada Presidente representa un club dentro del torneo: escudo, liga, presupuesto y estado competitivo en una sola pantalla.",
    status: "Disponible",
  },
  {
    icon: Users,
    title: "Plantilla",
    description:
      "Plantilla completa, vista campo, formación, táctica y situación de cada jugador frente al mercado. El corazón del producto.",
    status: "Disponible",
  },
  {
    icon: Handshake,
    title: "Mercado",
    description:
      "Jugadores libres, ofertas, trades y acuerdos reservados que se ejecutan al abrirse el draft.",
    status: "Disponible",
  },
  {
    icon: Trophy,
    title: "Competición",
    description:
      "Calendario ida y vuelta, jornadas, resultados, tabla y Match Center con los puntos fantasy de tu once.",
    status: "Disponible",
  },
];

const FEATURES = [
  {
    icon: Gauge,
    title: "Centro de control, no un portal",
    description:
      "La Home responde en cinco segundos: qué tengo, qué puedo hacer, qué está ocurriendo y qué viene después.",
  },
  {
    icon: Layers,
    title: "Motor de reglas único",
    description:
      "Presupuesto, cupos por posición, sub-21, club de origen y cierre de alineación se validan en un solo sitio, en navegador y servidor.",
  },
  {
    icon: Shirt,
    title: "Pizarra sin arrastrar",
    description:
      "Elige jugador, elige posición y confirma. El flujo funciona con teclado y lectores de pantalla, y también con ratón.",
  },
  {
    icon: ScanEye,
    title: "Transparencia de reglas",
    description:
      "Si una acción no es posible, el sistema explica la regla, las cifras y la alternativa. Nunca un error sin explicación humana.",
  },
  {
    icon: Crown,
    title: "Roles reales",
    description:
      "Ser Administrador es un permiso dentro del torneo. Puedes presidir un club y administrar el torneo con la misma cuenta.",
  },
  {
    icon: Sparkles,
    title: "Datos FC 27 versionados",
    description:
      "Importamos y normalizamos la base pública de ratings con su snapshot, para que el torneo sepa siempre qué versión usa.",
  },
];

const FLOW = [
  {
    step: "01",
    title: "Elige tu club",
    description:
      "Explora los clubes habilitados con su plantilla base, OVR medio y presupuesto antes de confirmar.",
  },
  {
    step: "02",
    title: "Recibe la plantilla",
    description:
      "El club llega con sus jugadores, valoraciones y situación inicial. Todo versionado y auditable.",
  },
  {
    step: "03",
    title: "Fija tu once",
    description:
      "Escoge entre cinco formaciones, coloca titulares y revisa la validación en vivo antes de guardar.",
  },
  {
    step: "04",
    title: "Cumple el reglamento",
    description:
      "Cupos por posición, sub-21 y máximo por club real se controlan solos en cada movimiento.",
  },
  {
    step: "05",
    title: "Compite",
    description:
      "El calendario, el mercado y el draft llegan en las siguientes fases sobre la misma base de clubes y plantillas.",
  },
];

const ACCESSIBILITY = [
  "Foco visible y no oculto en cada acción crítica",
  "Objetivos táctiles de 44 px o más",
  "Alternativa a arrastrar y soltar en la pizarra",
  "Estado comunicado con icono, texto y color",
  "Errores explicados con la regla y la cifra exacta",
];

const DEMO_CHECKS: RuleCheck[] = [
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
    detail:
      "Benjamin Pavard (DFC) no puede ocupar la posición ED de la formación 4-2-3-1.",
  },
];

const DEMO_XI = [
  { name: "André Onana", position: "POR", ovr: 83, group: "GK" as const, flag: "🇨🇲" },
  { name: "Diogo Dalot", position: "LD", ovr: 81, group: "DEF" as const, flag: "🇵🇹" },
  { name: "Matthijs de Ligt", position: "DFC", ovr: 84, group: "DEF" as const, flag: "🇳🇱" },
  { name: "Lisandro Martínez", position: "DFC", ovr: 84, group: "DEF" as const, flag: "🇦🇷" },
  { name: "Luke Shaw", position: "LI", ovr: 82, group: "DEF" as const, flag: "🇬🇧" },
  { name: "Manuel Ugarte", position: "MCD", ovr: 82, group: "MID" as const, flag: "🇺🇾" },
  { name: "Kobbie Mainoo", position: "MC", ovr: 82, group: "MID" as const, flag: "🇬🇧" },
  { name: "Alejandro Garnacho", position: "ED", ovr: 81, group: "FWD" as const, flag: "🇦🇷" },
  { name: "Bruno Fernandes", position: "MCO", ovr: 87, group: "MID" as const, flag: "🇵🇹" },
  { name: "Marcus Rashford", position: "EI", ovr: 85, group: "FWD" as const, flag: "🇬🇧" },
  { name: "Rasmus Højlund", position: "DC", ovr: 83, group: "FWD" as const, flag: "🇩🇰" },
];

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      variants={FADE_UP}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-navy-deep text-white">
      {/* ------------------------------------------------------------- Navbar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-deep/85 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-4 px-4 lg:px-8">
          <Link to="/" className="rounded-lg">
            <BrandLockup />
          </Link>
          <nav aria-label="Secciones" className="ml-auto hidden items-center gap-1 lg:flex">
            {[
              ["Producto", "#producto"],
              ["Pilares", "#pilares"],
              ["Roles", "#roles"],
              ["Reglas", "#reglas"],
              ["Accesibilidad", "#accesibilidad"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="min-h-11 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button asChild variant="ghost" className="min-h-11 text-white hover:bg-white/10 hover:text-white">
              <Link to="/auth?returnTo=%2Fdashboard">Entrar</Link>
            </Button>
            <Button asChild className="min-h-11">
              <Link to="/auth?returnTo=%2Fdashboard">
                Crear mi club
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage:
              "radial-gradient(60% 50% at 15% 0%, rgba(47,107,255,0.42) 0%, transparent 60%), radial-gradient(45% 45% at 85% 10%, rgba(31,157,85,0.32) 0%, transparent 65%)",
          }}
        />
        <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-24">
          <div>
            <motion.div
              variants={FADE_UP}
              initial="hidden"
              animate="show"
              transition={{ duration: 0.5 }}
            >
              <Badge className="border-white/15 bg-white/10 text-white/85">
                <Trophy className="size-3.5" aria-hidden="true" />
                Temporada 2025 / 2026 · Liga 11Eleven Foundation
              </Badge>
              <h1 className="display mt-6 text-4xl leading-[1.02] sm:text-5xl lg:text-6xl">
                Más que un jugador,
                <br />
                <span className="text-brand-bright">una liga de Presidentes.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70">
                11Eleven es la plataforma para presidir un club de fútbol fantasy: plantilla,
                formación, táctica y reglas verificadas por un motor que sabe qué puedes hacer,
                qué no y por qué.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="min-h-12 px-6 text-sm">
                  <Link to="/auth?returnTo=%2Fdashboard">
                    Entrar al centro de control
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="min-h-12 border-white/20 bg-white/5 px-6 text-sm text-white hover:bg-white/10 hover:text-white"
                >
                  <a href="#producto">Ver cómo funciona</a>
                </Button>
              </div>
              <dl className="mt-10 grid max-w-lg grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ["5", "Formaciones"],
                  ["20", "Jugadores por club"],
                  ["10", "Reglas del motor"],
                  ["AA", "WCAG 2.2"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <dt className="num display text-xl text-white">{value}</dt>
                    <dd className="text-[11px] font-semibold uppercase tracking-wide text-white/55">
                      {label}
                    </dd>
                  </div>
                ))}
              </dl>
            </motion.div>
          </div>

          {/* Control-room preview */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative"
          >
            <div className="rounded-2xl border border-white/12 bg-card p-4 text-foreground shadow-2xl">
              <div className="flex items-center gap-3">
                <Crest
                  name="Manchester United"
                  shortName="MUN"
                  colors={["#DA291C", "#FBE122"]}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="display truncate text-sm">Manchester United</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Premier League · @Ricardo · Jornada 12
                  </p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" />
                  Competición
                </span>
              </div>

              <dl className="num mt-4 grid grid-cols-4 gap-2 text-center">
                {[
                  ["20/20", "Plantilla"],
                  ["€892.5M", "Valor"],
                  ["83", "OVR"],
                  ["4-2-3-1", "Once"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-lg border bg-muted/40 px-2 py-2">
                    <dt className="display text-sm">{value}</dt>
                    <dd className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {label}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="pitch-surface mt-4 grid grid-cols-4 gap-2 rounded-xl p-3">
                {DEMO_XI.map((player) => (
                  <div key={player.name} className="flex flex-col items-center gap-1">
                    <PlayerAvatar
                      name={player.name}
                      flag={player.flag}
                      group={player.group}
                      size="xs"
                    />
                    <span className="num rounded bg-white/90 px-1 text-[10px] font-bold text-slate-900">
                      {player.ovr}
                    </span>
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-white/80">
                      {player.position}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  <ClipboardCheck className="size-3.5" aria-hidden="true" />
                  Validación del motor de reglas
                </p>
                <RuleCheckList checks={DEMO_CHECKS.slice(0, 2)} />
              </div>
            </div>

            <div className="pointer-events-none absolute -bottom-6 -right-2 hidden w-64 rounded-xl border border-white/12 bg-navy/90 p-3 text-xs text-white/80 shadow-xl sm:block">
              <p className="flex items-center gap-2 font-semibold text-white">
                <Lock className="size-3.5" aria-hidden="true" />
                Operación bloqueada
              </p>
              <p className="mt-1 leading-snug">
                Tu plantilla es de 20/20 jugadores: libera una plaza para inscribir a otro.
                Regla R-02.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Product */}
      <section id="producto" className="border-t border-white/10 bg-navy/60">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 lg:px-8 lg:py-20">
          <Reveal className="max-w-3xl">
            <p className="display text-xs tracking-[0.22em] text-brand-bright">
              El problema que resolvemos
            </p>
            <h2 className="display mt-3 text-3xl leading-tight sm:text-4xl">
              Un torneo fantasy se rompe cuando nadie sabe qué está permitido.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              La mayoría de plataformas empiezan por noticias y chat. Aquí empezamos por lo que un
              Presidente necesita saber: cómo está mi equipo, qué puedo hacer ahora, qué está
              pasando en el torneo y qué viene después. Todo lo demás apoya esos cuatro pilares.
            </p>
          </Reveal>

          <Reveal className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5"
              >
                <span
                  aria-hidden="true"
                  className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-bright/70 text-white"
                >
                  <feature.icon className="size-5" />
                </span>
                <h3 className="text-sm font-bold text-white">{feature.title}</h3>
                <p className="text-xs leading-relaxed text-white/65">{feature.description}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ Pillars */}
      <section id="pilares" className="border-t border-white/10">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 lg:px-8 lg:py-20">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="display text-xs tracking-[0.22em] text-brand-bright">
                Arquitectura de producto
              </p>
              <h2 className="display mt-3 text-3xl leading-tight sm:text-4xl">
                Club → Plantilla → Mercado → Competición
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-white/70">
                Los cuatro pilares ya están vivos sobre el mismo Tournament Engine: cada uno
                consulta el mismo motor de reglas, la misma base de jugadores y el mismo registro
                de auditoría.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-4 lg:grid-cols-4">
            {PILLARS.map((pillar, index) => (
              <Reveal key={pillar.title} delay={index * 0.06}>
                <div className="flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      aria-hidden="true"
                      className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-white"
                    >
                      <pillar.icon className="size-5" />
                    </span>
                    <span
                      className={
                        pillar.status === "Disponible"
                          ? "rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300"
                          : "rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/55"
                      }
                    >
                      {pillar.status}
                    </span>
                  </div>
                  <h3 className="display text-lg">{pillar.title}</h3>
                  <p className="text-xs leading-relaxed text-white/65">{pillar.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- Roles */}
      <section id="roles" className="border-t border-white/10 bg-navy/60">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-16 lg:grid-cols-2 lg:px-8 lg:py-20">
          <Reveal>
            <p className="display text-xs tracking-[0.22em] text-brand-bright">Roles</p>
            <h2 className="display mt-3 text-3xl leading-tight sm:text-4xl">
              Una cuenta, dos sombreros
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              Separamos estrictamente <strong className="text-white">persona</strong>,{" "}
              <strong className="text-white">presidencia</strong> y{" "}
              <strong className="text-white">rol administrativo</strong>. Tu cuenta puede presidir
              distintos clubes en torneos distintos, y administrar uno de ellos sin cambiar de
              usuario.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              {[
                {
                  icon: ShieldCheck,
                  title: "Presidente",
                  description:
                    "Gestiona su club: plantilla, once titular, táctica y situación de cada jugador frente al mercado.",
                },
                {
                  icon: Crown,
                  title: "Administrador",
                  description:
                    "Define reglas, presupuestos, cupos y fases del torneo, y consulta la auditoría completa de operaciones.",
                },
                {
                  icon: Accessibility,
                  title: "El árbitro invisible",
                  description:
                    "El sistema permite negociar y experimentar, pero impide acciones inválidas explicando la regla exacta.",
                },
              ].map((role) => (
                <div
                  key={role.title}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10"
                  >
                    <role.icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold">{role.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/65">
                      {role.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="rounded-2xl border border-white/12 bg-card p-5 text-foreground">
              <p className="display text-sm">Matriz de permisos</p>
              <p className="mt-1 text-xs text-muted-foreground">
                El rol administrativo se compone de permisos por área, así puedes tener un
                administrador de mercado o de calendario sin cambiar la arquitectura.
              </p>
              <ul className="mt-4 grid grid-cols-2 gap-2">
                {[
                  "Configuración",
                  "Presidentes",
                  "Jugadores",
                  "Mercado",
                  "Draft",
                  "Calendario",
                  "Noticias",
                  "Auditoría",
                ].map((permission) => (
                  <li
                    key={permission}
                    className="flex min-h-11 items-center gap-2 rounded-lg border bg-muted/40 px-3 text-xs font-semibold"
                  >
                    <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
                    {permission}
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
                La Administración incluye torneo, reglas, presidentes, roles, mercado, draft,
                jornadas y auditoría operativa sobre clubes y plantillas.
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* --------------------------------------------------------- Rule engine */}
      <section id="reglas" className="border-t border-white/10">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 lg:grid-cols-2 lg:px-8 lg:py-20">
          <Reveal>
            <p className="display text-xs tracking-[0.22em] text-brand-bright">Motor de reglas</p>
            <h2 className="display mt-3 text-3xl leading-tight sm:text-4xl">
              Una sola verdad para todo el torneo
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              Ninguna pantalla valida por su cuenta. Todas consultan el mismo motor, tanto en el
              navegador (validación en vivo) como en el servidor (verdad final). Si algo cambia
              mientras editas, la operación se rechaza con la explicación exacta.
            </p>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-white/55">
                Ejemplo de bloqueo explicado
              </p>
              <p className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-xs leading-relaxed text-rose-100">
                No puedes completar esta operación porque tu plantilla ya tiene 3 jugadores
                pertenecientes a este club de origen (Regla R-07). Libera una plaza o elige otro
                jugador.
              </p>
              <p className="mt-3 text-[11px] text-white/55">
                Nunca verás un «error 409»: verás qué regla se incumple, con qué cifras y qué
                alternativa tienes.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="rounded-2xl border border-white/12 bg-card p-5 text-foreground">
              <p className="display text-sm">Reglamento aplicado a tu club</p>
              <div className="mt-3">
                <RuleCheckList checks={DEMO_CHECKS} variant="full" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Flow */}
      <section className="border-t border-white/10 bg-navy/60">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 lg:px-8 lg:py-20">
          <Reveal className="max-w-2xl">
            <p className="display text-xs tracking-[0.22em] text-brand-bright">
              Flujo del Presidente
            </p>
            <h2 className="display mt-3 text-3xl leading-tight sm:text-4xl">
              De la invitación al once titular
            </h2>
          </Reveal>
          <ol className="mt-10 grid gap-4 lg:grid-cols-5">
            {FLOW.map((item, index) => (
              <Reveal key={item.step} delay={index * 0.05}>
                <li className="flex h-full flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <span className="num display text-2xl text-white/25">{item.step}</span>
                  <p className="text-sm font-bold text-white">{item.title}</p>
                  <p className="text-xs leading-relaxed text-white/65">{item.description}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------- Accessibility */}
      <section id="accesibilidad" className="border-t border-white/10">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-20">
          <Reveal>
            <p className="display text-xs tracking-[0.22em] text-brand-bright">Accesibilidad</p>
            <h2 className="display mt-3 text-3xl leading-tight sm:text-4xl">
              WCAG 2.2 AA desde el primer diseño
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              Los criterios de accesibilidad no son una revisión posterior: son una línea base de
              diseño del producto. Especialmente en la pizarra, donde la mayoría de plataformas
              funcionan solo arrastrando.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {ACCESSIBILITY.map((item) => (
                <li
                  key={item}
                  className="flex min-h-12 items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-xs leading-relaxed text-white/75"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-bright" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------------------- CTA */}
      <section className="border-t border-white/10 bg-gradient-to-br from-brand/25 via-navy-deep to-pitch/20">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-4 py-16 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-20">
          <Reveal>
            <h2 className="display max-w-2xl text-3xl leading-tight sm:text-4xl">
              Tu club está esperando Presidente
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75">
              Entra, elige tu club y gestiona la plantilla desde el primer minuto. Si eres el
              primer Presidente del torneo, además quedas como Administrador principal.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="min-h-12 px-6 text-sm">
                <Link to="/auth?returnTo=%2Fdashboard">
                  Crear mi club
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="min-h-12 border-white/25 bg-white/5 px-6 text-sm text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/auth?returnTo=%2Fdashboard">Ya tengo cuenta</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------------------- Footer */}
      <footer className="border-t border-white/10 bg-navy-deep">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <ElevenMark className="size-9" />
            <div>
              <p className="display text-sm">11Eleven</p>
              <p className="text-[11px] text-white/55">
                Fantasy Football Manager · Temporada 2025 / 2026
              </p>
            </div>
          </div>
          <nav aria-label="Enlaces del pie" className="flex flex-wrap gap-4 text-xs text-white/60">
            <a className="hover:text-white" href="#producto">
              Producto
            </a>
            <a className="hover:text-white" href="#roles">
              Roles
            </a>
            <a className="hover:text-white" href="#reglas">
              Reglas
            </a>
            <Link className="hover:text-white" to="/auth?returnTo=%2Fdashboard">
              Entrar
            </Link>
          </nav>
          <p className="text-[11px] text-white/45">
            Datos de jugadores basados en snapshots públicos de ratings (EA SPORTS FC 27 y SoFIFA)
            normalizados por la plataforma.
          </p>
        </div>
      </footer>
    </div>
  );
}
