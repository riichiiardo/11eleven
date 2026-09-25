import { useMemo, useState } from "react";
import type { AdminOverviewView, AppStateView } from "@/convex/appTypes";
import { api } from "@/convex/_generated/api";
import {
  RULE_DESCRIPTORS,
  TOURNAMENT_STATUSES,
  TOURNAMENT_STATUS_META,
  formatMoney,
  type TournamentRules,
} from "@/convex/rulesEngine";
import { errorMessage, relativeTime } from "@/lib/errors";
import { useNow } from "@/hooks/use-tournament";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { useNavigate, useOutletContext } from "react-router";
import { SectionCard } from "@/components/eleven/SectionCard";
import { Countdown, StatTile } from "@/components/eleven/SectionCard";
import { Crest } from "@/components/eleven/Crest";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Crown,
  Database,
  Gauge,
  Handshake,
  Hourglass,
  Loader2,
  PauseCircle,
  PlayCircle,
  ScrollText,
  ShieldCheck,
  SkipForward,
  StopCircle,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { useMarketActions } from "@/hooks/use-market-actions";
import { useDraftActions } from "@/hooks/use-draft-actions";
import { useCompetitionActions } from "@/hooks/use-competition-actions";
import { OfferCard } from "@/components/eleven/OfferCard";
import { OfferStatusPill } from "@/components/eleven/OfferBits";
import { TurnStrip, DraftStatusPill } from "@/components/eleven/DraftBits";
import { MatchCard, StandingsTable } from "@/components/eleven/MatchBits";
import {
  RefreshCw,
  Swords,
  Trophy,
} from "lucide-react";

const PERMISSION_LABELS: Record<string, string> = {
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

type RuleFormState = TournamentRules;

export default function Admin() {
  const state = useOutletContext<AppStateView>();
  const navigate = useNavigate();
  const overview = useQuery(api.tournament.adminOverview);

  if (!state.isAdmin) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-3 text-center">
        <ShieldCheck aria-hidden="true" className="size-8 text-muted-foreground" />
        <h1 className="display text-xl">Solo para Administradores</h1>
        <p className="text-sm text-muted-foreground">
          Administrar el torneo es un rol, no una cuenta distinta. Si necesitas acceso, pide al
          Administrador principal que asigne tu correo con los permisos correspondientes.
        </p>
        <Button onClick={() => navigate("/dashboard")} className="min-h-11">
          Volver al inicio
        </Button>
      </div>
    );
  }

  if (overview === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        <span className="sr-only">Cargando administración</span>
      </div>
    );
  }

  if (overview === null || !overview.tournament || !overview.rules) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        No se pudo cargar la información administrativa del torneo.
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="display text-2xl">Administración del torneo</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Control de reglas, presidentes y trazabilidad. Cada cambio que hagas aquí se aplica de
          inmediato al motor de reglas y queda registrado con tu nombre en la auditoría.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-gold/40 bg-gold/15 text-amber-700 dark:text-amber-300">
            <Crown className="size-3" aria-hidden="true" />
            {state.adminRole === "principal" ? "Administrador principal" : "Co-Administrador"}
          </Badge>
          <Badge variant="outline">
            {overview.tournament.name} · {overview.tournament.season}
          </Badge>
        </div>
      </header>

      <Tabs defaultValue="torneo" className="flex flex-col gap-4">
        <TabsList className="self-start">
          <TabsTrigger value="torneo" className="min-h-10">
            <Gauge className="size-4" aria-hidden="true" />
            Torneo
          </TabsTrigger>
          <TabsTrigger value="reglas" className="min-h-10">
            <ScrollText className="size-4" aria-hidden="true" />
            Reglas
          </TabsTrigger>
          <TabsTrigger value="presidentes" className="min-h-10">
            <Users className="size-4" aria-hidden="true" />
            Presidentes
          </TabsTrigger>
          <TabsTrigger value="mercado" className="min-h-10">
            <Handshake className="size-4" aria-hidden="true" />
            Mercado
          </TabsTrigger>
          <TabsTrigger value="draft" className="min-h-10">
            <Zap className="size-4" aria-hidden="true" />
            Draft
          </TabsTrigger>
          <TabsTrigger value="jornadas" className="min-h-10">
            <Swords className="size-4" aria-hidden="true" />
            Jornadas
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="min-h-10">
            <ScrollText className="size-4" aria-hidden="true" />
            Auditoría
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="min-h-10">
            <Database className="size-4" aria-hidden="true" />
            Catálogo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="torneo" className="flex flex-col gap-5">
          <TournamentPanel overview={overview} />
        </TabsContent>

        <TabsContent value="reglas" className="flex flex-col gap-5">
          <RulesPanel
            rules={overview.rules}
            presidents={overview.presidents}
            clubCount={overview.clubs.length}
          />
        </TabsContent>

        <TabsContent value="presidentes" className="flex flex-col gap-5">
          <PresidentsPanel overview={overview} />
        </TabsContent>

        <TabsContent value="mercado" className="flex flex-col gap-5">
          <MarketPanel overview={overview} />
        </TabsContent>

        <TabsContent value="draft" className="flex flex-col gap-5">
          <DraftPanel overview={overview} />
        </TabsContent>

        <TabsContent value="jornadas" className="flex flex-col gap-5">
          <CompetitionPanel overview={overview} />
        </TabsContent>

        <TabsContent value="auditoria">
          <SectionCard title="Registro de auditoría" icon={ScrollText} bodyClassName="p-0">
            <AuditList entries={overview.activity} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="catalogo" className="flex flex-col gap-5">
          <CatalogPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type CatalogSource = "ea" | "sofifa" | "snapshot";

const SOURCE_META: Record<CatalogSource, { label: string; hint: string }> = {
  ea: {
    label: "EA SPORTS FC 27 · ratings oficiales (19.789)",
    hint: "Fuente recomendada: los ratings oficiales de EA, 100 jugadores por página y sin proxy. Se importa en lotes para no agotar el tiempo de una sola operación.",
  },
  sofifa: {
    label: "SoFIFA · API pública (requiere proxy)",
    hint: "SoFIFA responde 403 (Cloudflare) a las IPs de datacenter. Solo funciona si defines SOFIFA_PROXY_URL (http://usuario:clave@host:puerto) en Convex → Settings → Environment Variables.",
  },
  snapshot: {
    label: "Snapshot local versionado (respaldo)",
    hint: "Importa los agentes libres incluidos con la app. Es el respaldo automático cuando ninguna fuente externa responde.",
  },
};

/**
 * Catálogo de jugadores: fuentes, estado de la sincronización y progreso.
 * Administración define la base de datos con la que juega el torneo; las
 * plantillas y la propiedad de jugadores nunca se tocan aquí.
 */
function CatalogPanel() {
  const catalog = useQuery(api.footballSync.catalogState);
  const syncAction = useAction(api.footballApi.syncCatalog);
  const [source, setSource] = useState<CatalogSource>("ea");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{
    page: number;
    totalPages: number;
    fetched: number;
    inserted: number;
    updated: number;
  } | null>(null);

  const handleSync = async () => {
    setBusy(true);
    setProgress(null);
    try {
      if (source === "snapshot") {
        const result = await syncAction({ source });
        toast.success("Snapshot local aplicado", {
          description: `${result.inserted} agentes libres incorporados · ${result.unchanged} ya estaban en el catálogo`,
        });
        return;
      }

      // EA pages are 1-based; SoFIFA cursors count full pages from 0.
      let page = source === "sofifa" ? 0 : 1;
      let totalPages = 0;
      let fetched = 0;
      let inserted = 0;
      let updated = 0;
      let unchanged = 0;
      let done = false;
      let guard = 0;
      let note: string | null = null;

      while (!done && guard < 80) {
        guard += 1;
        const result = await syncAction({ source, page });
        page = result.page;
        totalPages = result.totalPages || totalPages;
        fetched += result.fetched;
        inserted += result.inserted;
        updated += result.updated;
        unchanged += result.unchanged;
        done = result.done;
        if (result.note) note = result.note;
        setProgress({ page, totalPages, fetched, inserted, updated });
        if (result.fallback) {
          toast.warning(source === "sofifa" ? "SoFIFA no accesible" : "Fuente no accesible", {
            description: result.note ?? undefined,
          });
          return;
        }
        if (result.fetched === 0) break;
      }

      const summary = `${fetched} jugadores descargados · ${inserted} nuevos · ${updated} actualizados · ${unchanged} sin cambios`;
      if (note) {
        toast.warning("Sincronización parcial", {
          description: `${summary} · ${note}`,
        });
      } else {
        toast.success("Catálogo sincronizado", { description: summary });
      }
    } catch (cause) {
      toast.error("No se pudo sincronizar el catálogo", {
        description: errorMessage(cause),
      });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <SectionCard
      title="Catálogo de jugadores"
      icon={Database}
      accent="gold"
      bodyClassName="flex flex-col gap-5"
    >
      <p className="text-sm text-muted-foreground">
        El catálogo es la base de jugadores de la que beben el draft y el mercado. Sincroniza los
        ratings oficiales de EA SPORTS FC 27 (más de 19.000 jugadores) o, si prefieres, la API de
        SoFIFA con proxy. La importación avanza por lotes y nunca toca las plantillas ni la
        propiedad de los jugadores: solo se actualiza la tabla de jugadores.
      </p>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="catalog-source">Fuente de datos</Label>
          <Select
            value={source}
            onValueChange={(value) => setSource(value as CatalogSource)}
            disabled={busy}
          >
            <SelectTrigger id="catalog-source" className="min-h-11 w-full">
              <SelectValue placeholder="Selecciona una fuente" />
            </SelectTrigger>
            <SelectContent>
              { (Object.keys(SOURCE_META) as CatalogSource[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SOURCE_META[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{SOURCE_META[source].hint}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Database}
          label="Jugadores en catálogo"
          value={catalog === undefined ? "…" : String(catalog?.total ?? 0)}
        />
        <StatTile
          icon={Zap}
          label="Agentes libres"
          value={catalog === undefined ? "…" : String(catalog?.freeAgents ?? 0)}
          tone="pitch"
        />
        <StatTile
          icon={Users}
          label="En plantillas"
          value={catalog === undefined ? "…" : String(catalog?.owned ?? 0)}
          tone="slate"
        />
        <StatTile
          icon={Trophy}
          label="Versión"
          value={catalog?.version ?? "—"}
          tone="gold"
        />
      </div>

      {catalog?.lastSync && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <RefreshCw className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">Última sincronización:</span>
          <span className="font-medium">{relativeTime(catalog.lastSync.at)}</span>
          <Badge variant="outline">{catalog.lastSync.source}</Badge>
          <span className="text-muted-foreground">
            {catalog.lastSync.inserted} nuevos · {catalog.lastSync.updated} actualizados ·{" "}
            {catalog.lastSync.unchanged} sin cambios
          </span>
        </div>
      )}

      {catalog?.lastError && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">Último intento de sincronización falló</span>
            <span className="text-muted-foreground">
              {catalog.lastError.message} · {relativeTime(catalog.lastError.at)}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {busy && progress ? (
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold">
                Descargando página {progress.page}
                {progress.totalPages > 0 ? ` de ${progress.totalPages}` : "…"}
              </span>
              <span className="text-muted-foreground">
                {progress.fetched} descargados · {progress.inserted} nuevos · {progress.updated}{" "}
                actualizados
              </span>
            </div>
            <Progress
              className="mt-2 h-2"
              value={
                progress.totalPages > 0
                  ? Math.min(100, Math.round(((progress.page - 1) / progress.totalPages) * 100))
                  : 10
              }
            />
          </div>
        ) : null}

        <div>
          <Button onClick={handleSync} disabled={busy} className="min-h-11">
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            {busy
              ? "Sincronizando…"
              : source === "snapshot"
                ? "Aplicar snapshot local"
                : "Sincronizar catálogo completo"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            La descarga completa puede tardar unos minutos: se ejecuta por lotes y cada lote queda
            registrado en la auditoría con tu nombre.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

function TournamentPanel({ overview }: { overview: AdminOverviewView }) {
  const setStatus = useMutation(api.tournament.setTournamentStatus);
  const [busy, setBusy] = useState(false);
  const tournament = overview.tournament!;

  const update = async (status: string, marketOpen?: boolean) => {
    setBusy(true);
    try {
      await setStatus({
        status: status as (typeof TOURNAMENT_STATUSES)[number],
        marketOpen,
      });
      toast.success("Estado del torneo actualizado", {
        description: `Ahora el torneo está en fase «${TOURNAMENT_STATUS_META[status as (typeof TOURNAMENT_STATUSES)[number]].label}».`,
      });
    } catch (cause) {
      toast.error("No se pudo cambiar el estado", { description: errorMessage(cause) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Clubes del torneo" value={`${overview.clubs.length}`} hint={`${overview.totals.freeClubs} sin presidente`} />
        <MetricCard label="Plantillas registradas" value={`${overview.totals.squads}`} hint={`${overview.totals.players} jugadores asignados`} />
        <MetricCard label="Presupuesto asignado" value={formatMoney(overview.totals.committedBudget)} hint={`${overview.presidents.length} presidentes`} />
        <MetricCard label="Jornada actual" value={`${tournament.currentMatchday} / ${tournament.totalMatchdays}`} hint={tournament.statusLabel} />
      </div>

      <SectionCard title="Máquina de estados del torneo" icon={Gauge}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="tournamentStatus">Fase actual</Label>
            <Select
              value={tournament.status}
              disabled={busy}
              onValueChange={(value) => update(value)}
            >
              <SelectTrigger id="tournamentStatus" className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOURNAMENT_STATUSES.map((status) => (
                  <SelectItem key={status} value={status} className="min-h-11">
                    {TOURNAMENT_STATUS_META[status].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {TOURNAMENT_STATUS_META[tournament.status].hint}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Switch
              id="marketOpen"
              checked={tournament.marketOpen}
              disabled={busy}
              onCheckedChange={(checked) => update(tournament.status, checked)}
            />
            <Label htmlFor="marketOpen" className="text-sm">
              Ventana de mercado {tournament.marketOpen ? "abierta" : "cerrada"}
            </Label>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Clubes y presidencias" icon={Users} bodyClassName="p-0">
        <div className="overflow-x-auto scroll-thin">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Club</TableHead>
                <TableHead>Liga</TableHead>
                <TableHead className="text-center">Plantilla base</TableHead>
                <TableHead className="text-center">OVR medio</TableHead>
                <TableHead>Presidente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.clubs.map((club) => (
                <TableRow key={club.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Crest
                        name={club.name}
                        shortName={club.shortName}
                        colors={[club.colorPrimary, club.colorSecondary]}
                        size="sm"
                      />
                      <span className="text-sm font-semibold">{club.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{club.league}</TableCell>
                  <TableCell className="num text-center">{club.rosterSize}</TableCell>
                  <TableCell className="num text-center">{club.averageOvr}</TableCell>
                  <TableCell>
                    {club.presidentNickname ? (
                      <span className="text-sm font-semibold">{club.presidentNickname}</span>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Disponible
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </>
  );
}

/**
 * "Modo árbitro" (prompt §40): Administración opens the draft moment and every
 * reserved agreement is validated one last time against the live state before
 * it is applied. Failures keep their human explanation in the audit log.
 */
function MarketPanel({ overview }: { overview: AdminOverviewView }) {
  const { executeReserved, busyKey } = useMarketActions();
  const { market } = overview;
  const busy = busyKey === "ejecutar";

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Ventana de mercado"
          value={market.open ? "Abierta" : "Cerrada"}
          hint={
            market.open
              ? "Las operaciones se ejecutan al aceptarse"
              : "Los acuerdos se reservan hasta que la abras"
          }
        />
        <MetricCard
          label="Operaciones abiertas"
          value={`${market.pending}`}
          hint="Ofertas esperando respuesta"
        />
        <MetricCard
          label="Acuerdos reservados"
          value={`${market.reserved.length}`}
          hint="Listos para validación final"
        />
        <MetricCard
          label="Ejecutadas recientemente"
          value={`${market.recent.filter((offer) => offer.status === "ejecutada").length}`}
          hint={`${market.recent.length} en el historial completo`}
        />
      </div>

      <SectionCard title="Centro de control del mercado" icon={Handshake}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Al ejecutar, cada acuerdo vuelve a comprobarse contra el estado actual de
            ambas plantillas, los cupos por posición, el límite por club real y los
            presupuestos. Si algo cambió desde el acuerdo, la operación queda
            invalidada con el motivo registrado y los jugadores vuelven a estar
            disponibles.
          </p>
          <Button
            type="button"
            className="min-h-11 shrink-0"
            disabled={busy || market.reserved.length === 0}
            onClick={() => executeReserved()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <PlayCircle className="size-4" aria-hidden="true" />
            )}
            Validar y ejecutar reservadas
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Acuerdos reservados"
        icon={ScrollText}
        bodyClassName={market.reserved.length === 0 ? undefined : "p-4"}
      >
        {market.reserved.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay acuerdos reservados. Cuando dos Presidentes lleguen a un acuerdo
            aparecerá aquí con su validación final antes de aplicarse.
          </p>
        ) : (
          <ul className="grid gap-4 xl:grid-cols-2">
            {market.reserved.map((offer) => (
              <li key={offer.id} className="flex flex-col gap-2">
                <OfferCard offer={offer} />
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={busy}
                  onClick={() => executeReserved(offer.id)}
                >
                  <PlayCircle className="size-4" aria-hidden="true" />
                  Validar y ejecutar esta operación
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Últimas operaciones del torneo" icon={Users} bodyClassName="p-0">
        {market.recent.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Todavía no se ha registrado ninguna operación en el torneo.
          </p>
        ) : (
          <ul className="divide-y">
            {market.recent.slice(0, 10).map((offer) => (
              <li key={offer.id} className="flex flex-wrap items-center gap-2 p-3">
                <OfferStatusPill status={offer.status} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {offer.bidderClubName} → {offer.sellerClubName ?? "Agente libre"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {offer.requested.map((player) => player.name).join(", ") || "—"}
                </span>
                <span className="num text-xs font-bold">
                  {formatMoney(offer.cash)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {relativeTime(offer.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

/**
 * Draft tab — the "modo árbitro" control centre (prompt §40). Prepare the
 * order, open the window (which executes reserved agreements), pause/resume
 * the clock, skip a stuck turn and close the draft.
 */
function DraftPanel({ overview }: { overview: AdminOverviewView }) {
  const { prepare, open, pause, resume, skipTurn, close, busyKey } =
    useDraftActions();
  const { draft } = overview;
  const busy = busyKey !== null;
  const [form, setForm] = useState({
    totalRounds: 4,
    pickSeconds: 300,
    snake: true,
    orderMode: "inscripcion" as "inscripcion" | "sorteo",
  });

  const status = draft.status;
  const canPrepare = status === null || status === "borrador";
  const canOpen = status === "borrador";
  const canPause = status === "en_curso";
  const canResume = status === "pausado";
  const canSkip = status === "en_curso" || status === "pausado";
  const canClose = status === "en_curso" || status === "pausado";

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Estado del draft"
          value={draft.statusLabel ?? "Sin preparar"}
          hint={draft.statusHint ?? "Todavía no se ha preparado un orden de turnos"}
        />
        <MetricCard
          label="Turno actual"
          value={draft.currentNickname ?? "—"}
          hint={
            draft.currentClubName
              ? `Preside ${draft.currentClubName}`
              : "Nadie tiene el turno"
          }
        />
        <MetricCard
          label="Adquisiciones"
          value={`${draft.totalPicks}`}
          hint={`Ronda ${draft.round} de ${draft.totalRounds} · orden de ${draft.orderSize}`}
        />
        <MetricCard
          label="Acuerdos reservados"
          value={`${draft.reservedPending}`}
          hint={
            draft.reservedPending > 0
              ? "Se validarán al abrir el draft"
              : "Nada pendiente de ejecución"
          }
        />
      </div>

      <SectionCard title="Control del draft" icon={Zap}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <DraftStatusPill status={draft.status} />
          </div>
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Abrir el draft cierra la ventana de mercado y ejecuta los acuerdos
            reservados con validación final. Cada turno tiene reloj; pausar lo
            detiene para todos. Cerrar el draft fija las plantillas y devuelve
            el torneo a la fase previa a la competición.
          </p>

          <div className="flex flex-wrap gap-2">
            {canOpen ? (
              <Button
                type="button"
                className="min-h-11"
                disabled={busy}
                onClick={() => open()}
              >
                <PlayCircle className="size-4" aria-hidden="true" />
                Abrir draft
              </Button>
            ) : null}
            {canPause ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={busy}
                onClick={() => pause()}
              >
                <PauseCircle className="size-4" aria-hidden="true" />
                Pausar
              </Button>
            ) : null}
            {canResume ? (
              <Button
                type="button"
                className="min-h-11"
                disabled={busy}
                onClick={() => resume()}
              >
                <PlayCircle className="size-4" aria-hidden="true" />
                Reanudar
              </Button>
            ) : null}
            {canSkip ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={busy}
                onClick={() => skipTurn()}
              >
                <SkipForward className="size-4" aria-hidden="true" />
                Saltar turno
              </Button>
            ) : null}
            {canClose ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 border-rose-500/40 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
                disabled={busy}
                onClick={() => close()}
              >
                <StopCircle className="size-4" aria-hidden="true" />
                Cerrar draft
              </Button>
            ) : null}
          </div>

          {draft.currentDeadline !== null && draft.status === "en_curso" ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Hourglass className="size-3.5" aria-hidden="true" />
              Turno de {draft.currentNickname}: cierra en{" "}
              <Countdown target={draft.currentDeadline} label="" compact />
            </p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Orden de turnos" icon={Users}>
        <TurnStrip order={draft.turnOrder} />
        {draft.unsignedPresidents.length > 0 ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.06] p-3 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle
              className="mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
            {draft.unsignedPresidents.length} Presidente(s) se unieron después de
            preparar el orden: {draft.unsignedPresidents.join(", ")}. Vuelve a
            preparar el draft para incluirlos.
          </p>
        ) : null}
      </SectionCard>

      {canPrepare ? (
        <SectionCard title="Preparar draft" icon={Zap}>
          <p className="mb-4 text-xs text-muted-foreground">
            Configura rondas, reloj por turno y el orden antes de abrir. Puedes
            volver a preparar el draft mientras siga cerrado.
          </p>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void prepare(form);
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="draftRounds" className="text-xs">
                Rondas
              </Label>
              <Input
                id="draftRounds"
                type="number"
                min={1}
                max={30}
                className="h-11"
                value={form.totalRounds}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    totalRounds: Math.max(1, Number(event.target.value) || 1),
                  }))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Con {draft.orderSize} Presidente(s) serán{" "}
                {draft.orderSize * form.totalRounds} turnos en total.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="draftSeconds" className="text-xs">
                Segundos por turno
              </Label>
              <Input
                id="draftSeconds"
                type="number"
                min={30}
                step={30}
                className="h-11"
                value={form.pickSeconds}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    pickSeconds: Math.max(30, Number(event.target.value) || 30),
                  }))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Si el reloj llega a cero, Administración puede saltar el turno.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div>
                <Label htmlFor="draftSnake" className="text-xs font-semibold">
                  Orden serpiente
                </Label>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Las rondas pares invierten el orden, como en un draft real.
                </p>
              </div>
              <Switch
                id="draftSnake"
                checked={form.snake}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, snake: checked }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="draftOrder" className="text-xs">
                Orden de turnos
              </Label>
              <Select
                value={form.orderMode}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    orderMode: value as "inscripcion" | "sorteo",
                  }))
                }
              >
                <SelectTrigger id="draftOrder" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inscripcion">
                    Por orden de inscripción
                  </SelectItem>
                  <SelectItem value="sorteo">Sorteo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" className="min-h-11" disabled={busy}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Zap className="size-4" aria-hidden="true" />
                )}
                {status === "borrador" ? "Repreparar draft" : "Preparar draft"}
              </Button>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Historial de adquisiciones"
        icon={ScrollText}
        bodyClassName={draft.picks.length === 0 ? undefined : "p-0"}
      >
        {draft.picks.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Cada adquisición del draft quedará registrada aquí con su Presidente,
            su precio y su ronda.
          </p>
        ) : (
          <ul className="divide-y">
            {draft.picks
              .slice()
              .reverse()
              .slice(0, 20)
              .map((pickRow) => (
                <li
                  key={pickRow.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <span className="num flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold">
                    {pickRow.pickNumber}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {pickRow.playerName}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        {pickRow.position} · {pickRow.realClub}
                      </span>
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      Ronda {pickRow.round} · {pickRow.nickname} ({pickRow.clubName})
                      {pickRow.mode === "reserva"
                        ? " · acuerdo reservado"
                        : ""}
                    </p>
                  </div>
                  <span className="num text-sm font-bold">
                    {formatMoney(pickRow.price)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card-soft p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="num display mt-1 text-xl">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * Competition control: the "modo árbitro" for the calendar. The admin sees
 * the current matchday, its fixtures and closes it — the engine resolves
 * every match from the saved lineups and advances the tournament.
 */
function CompetitionPanel({ overview }: { overview: AdminOverviewView }) {
  const { sync, closeMatchday, busy } = useCompetitionActions();
  const competition = overview.competition;
  const current = competition.matchdays.find(
    (group) => group.status === "en_curso",
  );
  const leader = competition.leader;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Jornada en curso"
          value={competition.available ? `J${competition.currentMatchday}` : "—"}
          hint={
            competition.available
              ? `${competition.calendarMatchdays} jornadas en el calendario`
              : "Calendario sin generar"
          }
        />
        <MetricCard
          label="Partidos jugados"
          value={`${competition.playedCount}/${competition.totalCount}`}
          hint={`${competition.playedCount} resueltos de ${competition.totalCount} programados`}
        />
        <MetricCard
          label="Líder"
          value={leader ? leader.clubShortName : "—"}
          hint={
            leader
              ? `${leader.points} pts · ${leader.won}V ${leader.drawn}E ${leader.lost}D`
              : "Sin partidos jugados todavía"
          }
        />
        <MetricCard
          label="Temporada"
          value={`${competition.currentMatchday}/${competition.totalMatchdays}`}
          hint={`${overview.tournament?.season ?? "—"} · cierre de jornada manual`}
        />
      </div>

      <SectionCard
        title={`Cerrar jornada ${competition.currentMatchday}`}
        icon={Swords}
        accent="gold"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Al cerrar la jornada, cada partido se resuelve con los 11 titulares
            guardados en la Formación de cada club (snapshot auditable: los
            fichajes posteriores no reescriben resultados). La tabla se
            recalcula y la siguiente jornada pasa a estar en curso.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void sync()}
              disabled={busy}
              className="min-h-10"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Sincronizar calendario
            </Button>
            <Button
              onClick={() => void closeMatchday(competition.currentMatchday)}
              disabled={busy || !competition.available}
              className="min-h-10"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Swords className="size-4" aria-hidden="true" />
              )}
              Cerrar jornada {competition.currentMatchday}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {current
              ? `${current.playedCount}/${current.fixtures.length} partido(s) ya resueltos en esta jornada; el resto se resuelve al cerrar.`
              : "No hay jornada en curso: cierra una para activar la siguiente."}
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Partido destacado de la jornada" icon={Swords}>
        {current && current.fixtures.length > 0 ? (
          <div className="flex flex-col gap-2">
            {current.fixtures.map((fixture) => (
              <MatchCard key={fixture.id} fixture={fixture} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sin partidos programados en la jornada en curso.
          </p>
        )}
      </SectionCard>

      <SectionCard title="Tabla del torneo" icon={Trophy}>
        {competition.available ? (
          <StandingsTable rows={competition.standings} />
        ) : (
          <p className="text-sm text-muted-foreground">
            La tabla aparece en cuanto exista el calendario.
          </p>
        )}
      </SectionCard>
    </>
  );
}

function RulesPanel({
  rules,
  presidents,
  clubCount,
}: {
  rules: TournamentRules;
  presidents: Array<{ id: string; clubName: string; squadSize: number }>;
  clubCount: number;
}) {
  const updateRules = useMutation(api.tournament.updateRules);
  const [form, setForm] = useState<RuleFormState>(rules);
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
    const list: string[] = [];
    const groups: Array<[string, number, number]> = [
      ["porteros", form.gkMin, form.gkMax],
      ["defensas", form.defMin, form.defMax],
      ["medios", form.midMin, form.midMax],
      ["delanteros", form.fwdMin, form.fwdMax],
    ];
    for (const [label, min, max] of groups) {
      if (min > max) list.push(`En ${label} el mínimo no puede superar al máximo.`);
    }
    if (form.squadSize < 11 || form.squadSize > 40) {
      list.push("El tamaño de plantilla debe estar entre 11 y 40 jugadores.");
    }
    const minTotal = form.gkMin + form.defMin + form.midMin + form.fwdMin;
    if (minTotal > form.squadSize) {
      list.push(
        `Los mínimos por posición suman ${minTotal} jugadores y no caben en una plantilla de ${form.squadSize}.`,
      );
    }
    if (form.maxU21 < 0 || form.maxU21 > 15) {
      list.push("El límite de jugadores sub-21 debe estar entre 0 y 15.");
    }
    if (form.budget < 0) list.push("El presupuesto no puede ser negativo.");
    return list;
  }, [form]);

  const impacted = presidents.filter(
    (president) => president.squadSize > form.squadSize,
  );

  const dirty = JSON.stringify(form) !== JSON.stringify(rules);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (errors.length > 0) return;
    setBusy(true);
    try {
      const result = await updateRules(form);
      toast.success("Reglas del torneo actualizadas", {
        description:
          result.changed > 0
            ? `${result.changed} regla(s) modificadas. El motor de reglas ya las aplica.`
            : "No había cambios que registrar.",
      });
    } catch (cause) {
      toast.error("No se pudieron guardar las reglas", {
        description: errorMessage(cause),
      });
    } finally {
      setBusy(false);
    }
  };

  const numberField = (
    key: keyof RuleFormState,
    label: string,
    options?: { hint?: string; step?: number },
  ) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={key} className="text-xs">
        {label}
      </Label>
      <Input
        id={key}
        type="number"
        className="h-11"
        value={form[key] as number}
        step={options?.step ?? 1}
        onChange={(event) =>
          setForm((previous) => ({
            ...previous,
            [key]: Number(event.target.value),
          }))
        }
      />
      {options?.hint ? (
        <p className="text-[11px] text-muted-foreground">{options.hint}</p>
      ) : null}
    </div>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <SectionCard title="Reglas del torneo" icon={ScrollText}>
        <div className="grid gap-4">
          <fieldset className="grid gap-4 sm:grid-cols-3">
            <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Presupuesto y plantilla
            </legend>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="budgetMillions" className="text-xs">
                Presupuesto (millones €)
              </Label>
              <Input
                id="budgetMillions"
                type="number"
                className="h-11"
                step={5}
                value={Math.round(form.budget / 1_000_000)}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    budget: Number(event.target.value) * 1_000_000,
                  }))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Se asigna a cada Presidente nuevo: {formatMoney(form.budget)}
              </p>
            </div>
            {numberField("squadSize", "Tamaño máximo de plantilla", {
              hint: "Entre 11 y 40 jugadores",
            })}
            {numberField("maxU21", "Máximo de jugadores sub-21")}
            {numberField("maxPerRealClub", "Máximo por club real", {
              hint: "Evita concentrar la plantilla",
            })}
            {numberField("minOvr", "OVR mínimo para fichar")}
            {numberField("lineupLockHours", "Cierre de alineación (horas antes)", {
              hint: "Aplica a cada jornada",
            })}
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-4">
            <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Cupos por posición
            </legend>
            {numberField("gkMin", "Porteros mín.")}
            {numberField("gkMax", "Porteros máx.")}
            {numberField("defMin", "Defensas mín.")}
            {numberField("defMax", "Defensas máx.")}
            {numberField("midMin", "Medios mín.")}
            {numberField("midMax", "Medios máx.")}
            {numberField("fwdMin", "Delanteros mín.")}
            {numberField("fwdMax", "Delanteros máx.")}
          </fieldset>
        </div>
      </SectionCard>

      {errors.length > 0 ? (
        <div className="rounded-xl border border-rose-500/35 bg-rose-500/[0.06] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
            <AlertTriangle aria-hidden="true" className="size-4" />
            Revisa estas reglas antes de guardar
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {impacted.length > 0 ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/[0.07] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
            <AlertTriangle aria-hidden="true" className="size-4" />
            Impacto en presidencias actuales
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {impacted.length} club(es) superarían el nuevo máximo de{" "}
            {form.squadSize} jugadores:{" "}
            {impacted
              .slice(0, 4)
              .map((president) => `${president.clubName} (${president.squadSize})`)
              .join(", ")}
            {impacted.length > 4 ? ` y ${impacted.length - 4} más` : ""}. El motor marcará sus
            plantillas como incumplidas hasta que se ajusten.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="min-h-11" disabled={busy || errors.length > 0 || !dirty}>
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Guardando…
            </>
          ) : (
            "Guardar reglas"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!dirty || busy}
          onClick={() => setForm(rules)}
        >
          Descartar cambios
        </Button>
        <p className="text-xs text-muted-foreground">
          {clubCount} clubes · {presidents.length} presidentes afectados por estas reglas.
        </p>
      </div>

      <SectionCard title="Referencia de reglas" icon={ScrollText} bodyClassName="p-0">
        <ul className="divide-y">
          {RULE_DESCRIPTORS.map((descriptor) => (
            <li key={descriptor.code} className="flex items-start gap-3 p-3">
              <span className="display mt-0.5 rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                {descriptor.code}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{descriptor.title}</p>
                <p className="text-xs text-muted-foreground">{descriptor.description}</p>
              </div>
              <span className="num ml-auto shrink-0 text-sm font-semibold text-primary">
                {descriptor.value(form)}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </form>
  );
}

function PresidentsPanel({ overview }: { overview: AdminOverviewView }) {
  const grantAdmin = useMutation(api.tournament.grantAdmin);
  const revokeAdmin = useMutation(api.tournament.revokeAdmin);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"principal" | "coAdmin">("coAdmin");
  const [permissions, setPermissions] = useState<string[]>(["mercado", "jugadores"]);
  const [busy, setBusy] = useState(false);
  const now = useNow(60000);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await grantAdmin({ email, role, permissions });
      toast.success("Rol administrativo asignado", {
        description: `${email} ahora tiene ${result.granted} permiso(s) en el torneo.`,
      });
      setEmail("");
    } catch (cause) {
      toast.error("No se pudo asignar el rol", { description: errorMessage(cause) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionCard title="Presidentes del torneo" icon={Users} bodyClassName="p-0">
        <div className="overflow-x-auto scroll-thin">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Presidente</TableHead>
                <TableHead>Club</TableHead>
                <TableHead className="text-center">Plantilla</TableHead>
                <TableHead className="text-right">Presupuesto</TableHead>
                <TableHead>Rol administrativo</TableHead>
                <TableHead>Se unió</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.presidents.map((president) => (
                <TableRow key={president.id}>
                  <TableCell>
                    <p className="text-sm font-semibold">{president.displayName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {president.nickname} · {president.email}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">{president.clubName}</TableCell>
                  <TableCell className="num text-center">{president.squadSize}</TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(president.budget)}
                  </TableCell>
                  <TableCell>
                    {president.adminRole ? (
                      <span className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-gold/40 bg-gold/15 text-amber-700 dark:text-amber-300"
                        >
                          {president.adminRole === "principal"
                            ? "Administrador principal"
                            : "Co-Administrador"}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-h-9"
                          onClick={() => revokeAdmin({ userId: president.userId })}
                        >
                          Retirar
                        </Button>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Presidencia</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {relativeTime(president.joinedAt, now)}
                  </TableCell>
                </TableRow>
              ))}
              {overview.presidents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">
                    Todavía no hay Presidentes registrados en el torneo.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <SectionCard title="Invitar a un Administrador" icon={UserPlus}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            El rol administrativo se asigna a una cuenta existente: la persona debe registrarse
            primero con ese correo. Puede seguir siendo Presidente de su club.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adminEmail" className="text-xs">
                Correo de la cuenta
              </Label>
              <Input
                id="adminEmail"
                type="email"
                className="h-11"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="presidente@correo.com"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adminRole" className="text-xs">
                Rol
              </Label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as "principal" | "coAdmin")}
              >
                <SelectTrigger id="adminRole" className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coAdmin" className="min-h-11">
                    Co-Administrador (permisos configurables)
                  </SelectItem>
                  <SelectItem value="principal" className="min-h-11">
                    Administrador principal (todos los permisos)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {role === "coAdmin" ? (
            <fieldset>
              <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Permisos del torneo
              </legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {Object.entries(PERMISSION_LABELS).map(([key, label]) => {
                  const checked = permissions.includes(key);
                  return (
                    <label
                      key={key}
                      className="flex min-h-11 items-center gap-2 rounded-lg border p-2.5 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          setPermissions((previous) =>
                            value
                              ? [...previous, key]
                              : previous.filter((item) => item !== key),
                          )
                        }
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <Button type="submit" className="min-h-11 self-start" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Asignando…
              </>
            ) : (
              "Asignar rol"
            )}
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Administradores actuales" icon={ShieldCheck} bodyClassName="p-0">
        <ul className="divide-y">
          {overview.admins.map((admin) => (
            <li key={admin.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{admin.displayName}</p>
                <p className="text-[11px] text-muted-foreground">{admin.email}</p>
              </div>
              <Badge variant="outline">
                {admin.role === "principal" ? "Administrador principal" : "Co-Administrador"}
              </Badge>
              <p className="text-[11px] text-muted-foreground">
                {admin.permissions.length} permiso(s)
              </p>
            </li>
          ))}
        </ul>
      </SectionCard>
    </>
  );
}

function AuditList({ entries }: { entries: AdminOverviewView["activity"] }) {
  const now = useNow(60000);
  return (
    <ul className="divide-y">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:gap-4">
          <span className="num shrink-0 text-[11px] text-muted-foreground sm:w-32">
            {new Date(entry.createdAt).toLocaleString("es-ES", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{entry.action}</p>
            <p className="text-xs leading-snug text-muted-foreground">{entry.detail}</p>
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {entry.actorName} · {relativeTime(entry.createdAt, now)}
          </span>
        </li>
      ))}
      {entries.length === 0 ? (
        <li className="p-4 text-sm text-muted-foreground">
          Todavía no hay operaciones registradas.
        </li>
      ) : null}
    </ul>
  );
}
