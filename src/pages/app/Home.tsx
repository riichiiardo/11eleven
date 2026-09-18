import type { AppStateView } from "@/convex/appTypes";
import { formatMoney, TOURNAMENT_STATUS_META } from "@/convex/rulesEngine";
import { useOutletContext, useNavigate, Link } from "react-router";
import { relativeTime } from "@/lib/errors";
import { useNow } from "@/hooks/use-tournament";
import { Crest } from "@/components/eleven/Crest";
import { Countdown, SectionCard, StatTile, StatusPill, ToneDot } from "@/components/eleven/SectionCard";
import { PitchView } from "@/components/eleven/PitchView";
import { GroupMeter, RuleCheckList } from "@/components/eleven/RuleCheckList";
import { AvailabilityBadge, OvrBadge, PlayerAvatar } from "@/components/eleven/PlayerBits";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Activity,
  BadgeEuro,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Crown,
  Info,
  ShieldAlert,
  Shirt,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  const state = useOutletContext<AppStateView>();
  const navigate = useNavigate();
  const now = useNow(30000);

  const tournament = state.tournament;
  const club = state.club;
  const president = state.president;
  const stats = state.stats;
  const rules = state.rules;
  if (!tournament || !club || !president || !stats || !rules || !state.lineup) return null;

  const statusMeta = TOURNAMENT_STATUS_META[tournament.status];
  const nextEvent = state.nextEvent;
  const limits = {
    GK: { min: rules.gkMin, max: rules.gkMax },
    DEF: { min: rules.defMin, max: rules.defMax },
    MID: { min: rules.midMin, max: rules.midMax },
    FWD: { min: rules.fwdMin, max: rules.fwdMax },
  };

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
      {/* ---------------------------------------------------------- Club header */}
      <section className="card-soft overflow-hidden">
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:gap-6 lg:p-5">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Crest
              name={club.name}
              shortName={club.shortName}
              colors={[club.colorPrimary, club.colorSecondary]}
              size="xl"
            />
            <div className="min-w-0">
              <h1 className="display truncate text-2xl leading-tight sm:text-3xl">
                {club.name}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>{club.league}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-foreground">{president.nickname}</span>
                <span aria-hidden="true">·</span>
                <span>{president.displayName}</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusPill className={statusMeta.className}>
                  <ToneDot tone={statusMeta.tone} />
                  {statusMeta.label}
                </StatusPill>
                <StatusPill className="border-border bg-muted text-muted-foreground">
                  Temporada {tournament.season}
                </StatusPill>
                {president.isAdmin ? (
                  <StatusPill className="border-gold/40 bg-gold/15 text-amber-700 dark:text-amber-300">
                    <Crown className="size-3" aria-hidden="true" />
                    Administrador
                  </StatusPill>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:w-[430px]">
            <div className="rounded-xl border bg-muted/40 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <Trophy className="size-3.5" aria-hidden="true" />
                Jornada {tournament.currentMatchday}
              </p>
              <p className="mt-1 truncate text-sm font-semibold">
                {nextEvent?.rivalName
                  ? `${club.shortName} vs ${nextEvent.rivalShortName}`
                  : "Calendario en preparación"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {nextEvent
                  ? new Date(nextEvent.kickoffAt).toLocaleString("es-ES", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Administración publicará la próxima jornada."}
              </p>
            </div>
            <div className="rounded-xl border border-brand/25 bg-brand/[0.06] p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                <CalendarClock className="size-3.5" aria-hidden="true" />
                Cierre de alineación
              </p>
              {nextEvent ? (
                <Countdown
                  target={nextEvent.lockAt}
                  label=""
                  className="mt-1 block text-lg font-bold"
                  compact
                />
              ) : (
                <p className="mt-1 text-sm font-semibold">Sin jornada activa</p>
              )}
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {nextEvent?.locked
                  ? "El once de esta jornada ya está bloqueado."
                  : `Se bloquea ${rules.lineupLockHours} h antes del inicio.`}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ KPIs */}
      <section aria-label="Indicadores del club" className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile
          icon={Users}
          tone="brand"
          value={`${stats.size} / ${rules.squadSize}`}
          label="Plantilla"
          hint={
            rules.squadSize - stats.size > 0
              ? `${rules.squadSize - stats.size} plazas libres`
              : "Plantilla completa"
          }
        />
        <StatTile
          icon={TrendingUp}
          tone="pitch"
          value={formatMoney(stats.totalValue)}
          label="Valor de plantilla"
          hint={`${stats.topPlayers[0]?.name.split(" ")[0] ?? "—"} lidera`}
        />
        <StatTile
          icon={BadgeEuro}
          tone="gold"
          value={formatMoney(state.budget.available)}
          label="Presupuesto"
          hint={`Inicial ${formatMoney(state.budget.initial)}`}
        />
        <StatTile
          icon={Crown}
          tone="brand"
          value={`${stats.averageOvr}`}
          label="Media OVR"
          hint={`Máx. ${stats.topPlayers[0]?.ovr ?? "—"}`}
        />
        <StatTile
          icon={Activity}
          tone="slate"
          value={`${stats.averageAge}`}
          label="Edad media"
          hint={`${stats.under21} sub-21`}
        />
        <StatTile
          icon={Shirt}
          tone="pitch"
          value={state.lineup.formation}
          label="Formación actual"
          hint={`${state.lineupEvaluation?.starters.length ?? 0} titulares`}
        />
      </section>

      {/* -------------------------------------------------------- Qué debo hacer */}
      <section className="flex flex-col gap-3">
        <h2 className="display flex items-center gap-2 text-sm">
          <span aria-hidden="true" className="h-4 w-1 rounded-full bg-gold" />
          Qué debo hacer
        </h2>
        {state.actions.length === 0 ? (
          <div className="card-soft flex items-center gap-3 p-4">
            <CheckCircle2 aria-hidden="true" className="size-5 text-emerald-600" />
            <p className="text-sm">
              Todo en orden. Tu plantilla y tu once cumplen el reglamento: {stats.size}/
              {rules.squadSize} jugadores
              {nextEvent
                ? ` y la alineación se cierra en ${Math.max(
                    0,
                    Math.round((nextEvent.lockAt - now) / 3600000),
                  )} h.`
                : "."}
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {state.actions.map((action) => (
              <li key={action.id}>
                <div
                  className={cn(
                    "card-soft flex h-full flex-col gap-2 p-4",
                    action.tone === "warning" && "border-amber-500/35",
                    action.tone === "danger" && "border-rose-500/35",
                    action.tone === "positive" && "border-emerald-500/35",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <ActionIcon tone={action.tone} />
                    <p className="text-sm font-bold">{action.title}</p>
                  </span>
                  <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
                    {action.description}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 self-start"
                    onClick={() => navigate(action.action.to)}
                  >
                    {action.action.label}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ----------------------------------------------------------- Main grid */}
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="flex flex-col gap-5 xl:col-span-2">
          <SectionCard
            title="Mi alineación titular"
            icon={Shirt}
            accent="pitch"
            action={{ label: "Ver plantilla completa", to: "/dashboard/club/plantilla" }}
          >
            <PitchView
              formation={state.lineup.formation}
              lineup={state.lineup}
              squad={state.squad}
              onSlotClick={() => navigate("/dashboard/formacion")}
              caption="Selecciona una posición para ajustar tu once. También puedes gestionar la alineación sin arrastrar: elige jugador, elige posición y confirma."
            />
            <dl className="mt-4 grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-3">
              <MiniStat icon={TrendingUp} label="Valor del XI" value={formatMoney(
                (state.lineupEvaluation?.starters ?? []).reduce((sum, player) => sum + player.value, 0),
              )} />
              <MiniStat
                icon={Activity}
                label="Edad media XI"
                value={`${
                  state.lineupEvaluation?.starters.length
                    ? Math.round(
                        (state.lineupEvaluation.starters.reduce((sum, p) => sum + p.age, 0) /
                          state.lineupEvaluation.starters.length) *
                          10,
                      ) / 10
                    : 0
                }`}
              />
              <MiniStat
                icon={Crown}
                label="OVR medio XI"
                value={`${
                  state.lineupEvaluation?.starters.length
                    ? Math.round(
                        (state.lineupEvaluation.starters.reduce((sum, p) => sum + p.ovr, 0) /
                          state.lineupEvaluation.starters.length) *
                          10,
                      ) / 10
                    : 0
                }`}
              />
            </dl>
          </SectionCard>

          <SectionCard
            title="Cumplimiento del reglamento"
            icon={ClipboardList}
            action={{ label: "Ver reglas", to: "/dashboard/reglas" }}
          >
            <RuleCheckList checks={state.evaluation?.checks ?? []} />
          </SectionCard>
        </div>

        <div className="flex flex-col gap-5">
          <SectionCard title="Próximos eventos" icon={CalendarClock}>
            <ul className="flex flex-col gap-3">
              <EventRow
                icon={Trophy}
                title={`Jornada ${tournament.currentMatchday}`}
                detail={
                  nextEvent?.rivalName
                    ? `${club.name} vs ${nextEvent.rivalName}`
                    : "Rival por confirmar"
                }
                trailing={
                  nextEvent
                    ? new Date(nextEvent.kickoffAt).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                      })
                    : "—"
                }
              />
              <EventRow
                icon={CalendarClock}
                title="Cierre de alineación"
                detail={`${rules.lineupLockHours} h antes del inicio`}
                trailing={
                  nextEvent ? <Countdown target={nextEvent.lockAt} label="" compact /> : "—"
                }
              />
              <EventRow
                icon={BadgeEuro}
                title="Ventana de mercado"
                detail={
                  tournament.marketOpen
                    ? "Puedes negociar y fichar"
                    : "Cerrada hasta la próxima ventana"
                }
                trailing={
                  <StatusPill
                    className={
                      tournament.marketOpen
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-border bg-muted text-muted-foreground"
                    }
                  >
                    {tournament.marketOpen ? "Abierta" : "Cerrada"}
                  </StatusPill>
                }
              />
            </ul>
            <p className="mt-3 flex gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {statusMeta.hint}
            </p>
          </SectionCard>

          <SectionCard
            title="Estado de la plantilla"
            icon={Users}
            action={{ label: "Gestionar", to: "/dashboard/club/estado" }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {(["GK", "DEF", "MID", "FWD"] as const).map((group) => (
                <GroupMeter
                  key={group}
                  group={group}
                  count={stats.groupCounts[group]}
                  min={limits[group].min}
                  max={limits[group].max}
                />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(
                ["transferible", "negociacion", "neutro", "intransferible"] as const
              ).map((option) => (
                <span key={option} className="inline-flex items-center gap-1.5">
                  <AvailabilityBadge availability={option} />
                  <span className="num text-xs font-semibold text-muted-foreground">
                    {state.availability[option]}
                  </span>
                </span>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Actividad reciente" icon={Activity}>
            {state.activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay operaciones registradas en el torneo.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {state.activity.slice(0, 6).map((entry) => (
                  <li key={entry.id} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-1 size-2 shrink-0 rounded-full bg-brand/60"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{entry.action}</p>
                      <p className="text-xs leading-snug text-muted-foreground">
                        {entry.detail}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {entry.actorName} · {relativeTime(entry.createdAt, now)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      {/* --------------------------------------------------- Jugadores destacados */}
      <SectionCard
        title="Jugadores destacados de tu plantilla"
        icon={Crown}
        action={{ label: "Ver plantilla", to: "/dashboard/club/plantilla" }}
      >
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.topPlayers.map((player) => (
            <li
              key={player.squadPlayerId}
              className="flex flex-col gap-3 rounded-xl border bg-gradient-to-br from-card to-muted/40 p-3"
            >
              <div className="flex items-center gap-3">
                <PlayerAvatar
                  name={player.name}
                  flag={player.flag}
                  group={player.group}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{player.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {player.nationality} · {player.position}
                  </p>
                </div>
                <OvrBadge ovr={player.ovr} className="ml-auto" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="num text-sm font-bold text-primary">
                  {formatMoney(player.value)}
                </span>
                <AvailabilityBadge availability={player.availability} showLabel={false} />
              </div>
            </li>
          ))}
          <li className="flex flex-col justify-between gap-3 rounded-xl border border-dashed p-3">
            <p className="text-sm text-muted-foreground">
              {stats.size - stats.topPlayers.length} jugadores más forman parte de tu plantilla.
            </p>
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/dashboard/club/plantilla">Abrir plantilla</Link>
            </Button>
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}

function ActionIcon({ tone }: { tone: "warning" | "info" | "positive" | "danger" }) {
  const map = {
    warning: { Icon: AlertTriangle, className: "bg-amber-500/15 text-amber-600" },
    danger: { Icon: ShieldAlert, className: "bg-rose-500/15 text-rose-600" },
    positive: { Icon: CheckCircle2, className: "bg-emerald-500/15 text-emerald-600" },
    info: { Icon: Info, className: "bg-brand/12 text-primary" },
  }[tone];
  return (
    <span
      aria-hidden="true"
      className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", map.className)}
    >
      <map.Icon className="size-3.5" />
    </span>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="num truncate text-sm font-bold">{value}</dd>
      </div>
    </div>
  );
}

function EventRow({
  icon: Icon,
  title,
  detail,
  trailing,
}: {
  icon: typeof Activity;
  title: string;
  detail: string;
  trailing: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{detail}</p>
      </div>
      <span className="num shrink-0 text-xs font-semibold text-muted-foreground">
        {trailing}
      </span>
    </li>
  );
}
