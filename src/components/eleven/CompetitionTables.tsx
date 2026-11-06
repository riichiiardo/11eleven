import { useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, ChevronDown, PlayCircle, Users } from "lucide-react";
import type {
  RecordedCompetition,
  RecordedMatch,
  RecordedStat,
} from "@/domain/competition-records";
import { broadcastEvidencePath } from "@/domain/broadcast";
import { cn } from "@/lib/utils";
import { Crest } from "./Crest";

const clubColors: [string, string] = ["#1d4ed8", "#0b1a30"];
function TeamIdentity({
  name,
  match = false,
  away = false,
}: {
  name: string;
  match?: boolean;
  away?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-2.5",
        match && "flex-col text-center sm:flex-row sm:text-left",
        match && away && "sm:flex-row-reverse sm:text-right",
      )}
    >
      <Crest
        name={name}
        shortName={initials}
        colors={clubColors}
        size={match ? "lg" : "sm"}
        className={match ? "size-11 sm:size-14" : "size-8"}
      />
      <span
        className={cn(
          "min-w-0 break-words font-semibold leading-snug",
          match ? "text-xs sm:text-sm" : "text-xs sm:text-[13px]",
        )}
      >
        {name}
      </span>
    </span>
  );
}

function StatDetail({
  rows,
  match,
}: {
  rows: RecordedStat[] | null;
  match: RecordedMatch;
}) {
  if (rows === null)
    return <span className="text-muted-foreground">Sin verificar</span>;
  if (!rows.length)
    return (
      <span className="text-muted-foreground">Ninguno, según el reporte</span>
    );
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={i}>
          <span className="mb-1 flex items-center justify-between gap-2 font-semibold">
            <span>
              {r.player}
              {r.ownGoal ? " (autogol)" : ""}
            </span>
            <span className="num rounded bg-primary/10 px-2 py-0.5 text-primary">
              ×{r.count}
            </span>
          </span>
          <TeamIdentity
            name={r.teamId === match.homeId ? match.home : match.away}
          />
        </li>
      ))}
    </ul>
  );
}

function ResultCard({ match: m }: { match: RecordedMatch }) {
  const to = broadcastEvidencePath(m.videoId, m.evidenceSecond);
  return (
    <article
      aria-label={`${m.home} contra ${m.away}`}
      className="min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5 text-[10px] font-semibold">
        <span className="text-muted-foreground">{m.stage || "Partido"}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-1",
            m.verified
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-muted text-muted-foreground",
          )}
        >
          {m.verified ? (
            <CheckCircle2 className="size-3" aria-hidden="true" />
          ) : null}
          {m.verified ? "Verificado" : "Pendiente de verificar"}
        </span>
      </header>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 py-5">
        <div className="min-w-0">
          <TeamIdentity name={m.home} match />
          <p className="mt-2 text-center text-[9px] uppercase tracking-widest text-muted-foreground sm:text-left">
            Local
          </p>
        </div>
        <div className="text-center">
          <div
            aria-label={`Marcador: ${m.homeGoals ?? "sin verificar"} a ${m.awayGoals ?? "sin verificar"}`}
            className="num display flex min-w-20 items-center justify-center gap-2 rounded-xl bg-navy px-3 py-2.5 text-2xl font-bold text-white sm:min-w-24 sm:text-3xl"
          >
            <span>{m.homeGoals ?? "—"}</span>
            <span className="text-base text-white/40">–</span>
            <span>{m.awayGoals ?? "—"}</span>
          </div>
          <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            {m.verified ? "Final" : "Pendiente"}
          </p>
        </div>
        <div className="min-w-0">
          <TeamIdentity name={m.away} match away />
          <p className="mt-2 text-center text-[9px] uppercase tracking-widest text-muted-foreground sm:text-right">
            Visitante
          </p>
        </div>
      </div>
      {m.homePenalties !== null ? (
        <p className="mb-3 text-center text-xs text-muted-foreground">
          Penaltis: {m.homePenalties}–{m.awayPenalties} (fuera del marcador)
        </p>
      ) : null}
      <details className="group border-t bg-muted/15">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-semibold">
          Detalle del partido
          <ChevronDown
            className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <dl className="grid gap-3 px-4 pb-4 text-xs sm:grid-cols-2">
          {(
            [
              ["Goles", m.goals],
              ["Asistencias", m.assists],
              ["Amarillas", m.yellowCards],
              ["Rojas", m.redCards],
            ] as [string, RecordedStat[] | null][]
          ).map(([label, rows]) => (
            <div key={label} className="rounded-lg border bg-card p-3">
              <dt className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {label}
              </dt>
              <dd>
                <StatDetail rows={rows} match={m} />
              </dd>
            </div>
          ))}
        </dl>
      </details>
      <footer className="border-t px-4 py-2.5">
        {to ? (
          <Link
            to={to}
            className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-primary underline-offset-4 hover:underline"
          >
            <PlayCircle className="size-4 shrink-0" aria-hidden="true" />
            Ver evidencia en Transmisiones
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">
            Grabación pendiente de catálogo.
          </p>
        )}
      </footer>
    </article>
  );
}

export function RecordedResults({
  competition: c,
}: {
  competition: RecordedCompetition;
}) {
  const [round, setRound] = useState("all");
  const groups = new Map<string, { label: string; matches: RecordedMatch[] }>();
  for (const m of [...c.matches].sort(
    (a, b) => (b.round ?? 0) - (a.round ?? 0),
  )) {
    const key = m.round ? `round-${m.round}` : `stage-${m.stage}`;
    if (!groups.has(key))
      groups.set(key, {
        label: m.round ? `Jornada ${m.round}` : m.stage || "Partidos",
        matches: [],
      });
    groups.get(key)!.matches.push(m);
  }
  if (!c.matches.length)
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
        Aún no hay resultados revisados. Las grabaciones localizadas no se
        convierten automáticamente en resultados.
      </div>
    );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Marcadores y actas por jornada
        </p>
        <label className="flex items-center gap-2 text-xs font-semibold">
          Jornada o fase
          <select
            aria-label="Filtrar resultados por jornada o fase"
            className="min-h-10 rounded-lg border bg-background text-xs"
            value={round}
            onChange={(e) => setRound(e.target.value)}
          >
            <option value="all">Todas</option>
            {[...groups].map(([key, g]) => (
              <option key={key} value={key}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {[...groups]
        .filter(([key]) => round === "all" || key === round)
        .map(([key, group]) => (
          <section key={key} aria-label={group.label} className="space-y-3">
            <h3 className="display flex items-center gap-3 text-sm font-bold">
              {group.label}
              <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                {group.matches.length} partido(s)
              </span>
              <span className="h-px flex-1 bg-border" />
            </h3>
            <div className="grid gap-4 xl:grid-cols-2">
              {group.matches.map((m) => (
                <ResultCard key={m.id} match={m} />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}

const statCell = "num px-3 py-4 text-center text-[13px] tabular-nums";
const headerCell =
  "px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground";
export function RecordedStandings({
  competition: c,
}: {
  competition: RecordedCompetition;
}) {
  if (c.format === "cup")
    return (
      <p className="rounded-xl border bg-muted/20 p-5 text-sm text-muted-foreground">
        Esta copa se consulta por fases y resultados; no se mezclan sus
        encuentros con los puntos de las ligas.
      </p>
    );
  if (!c.standings.length)
    return (
      <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        Sin clasificación calculable: todavía no hay partidos verificados.
      </p>
    );
  return (
    <div className="overflow-hidden rounded-2xl border shadow-sm">
      <div
        className="overflow-x-auto focus-visible:outline-primary"
        role="region"
        aria-label="Tabla de clasificación, desplazable horizontalmente"
        tabIndex={0}
      >
        <table className="w-full min-w-[660px] border-separate border-spacing-0 text-sm">
          <caption className="bg-muted/30 px-4 py-3 text-left text-xs font-semibold">
            Clasificación provisional · solo partidos verificados
          </caption>
          <thead className="bg-muted/60">
            <tr>
              <th
                scope="col"
                className={cn(
                  headerCell,
                  "sticky left-0 z-10 w-60 bg-muted pl-4 text-left",
                )}
              >
                Pos. / Equipo
              </th>
              {["PJ", "G", "E", "P", "GF", "GC", "DG", "Pts"].map((h) => (
                <th key={h} scope="col" className={headerCell}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.standings.map((r, i) => (
              <tr key={r.team} className="group">
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-10 border-t border-border/60 px-4 py-3 text-left transition-colors group-hover:bg-accent",
                    i === 0
                      ? "bg-amber-50 dark:bg-amber-950"
                      : i % 2
                        ? "bg-muted"
                        : "bg-card",
                  )}
                >
                  <span className="flex w-44 items-center gap-3 sm:w-52">
                    <span
                      title={
                        i === 0 ? "Líder provisional" : `Posición ${i + 1}`
                      }
                      className={cn(
                        "num flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold",
                        i === 0
                          ? "bg-amber-500/20 text-amber-800 dark:text-amber-200"
                          : "bg-background text-muted-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                    <TeamIdentity name={r.team} />
                  </span>
                </th>
                {[
                  r.played,
                  r.won,
                  r.drawn,
                  r.lost,
                  r.goalsFor,
                  r.goalsAgainst,
                ].map((n, j) => (
                  <td
                    key={j}
                    className={cn(
                      statCell,
                      "border-t border-border/60 transition-colors group-hover:bg-primary/5",
                      i % 2 ? "bg-muted/30" : "bg-card",
                    )}
                  >
                    {n}
                  </td>
                ))}
                <td
                  className={cn(
                    statCell,
                    "border-t border-border/60 font-semibold group-hover:bg-primary/5",
                    r.goalDifference > 0
                      ? "text-emerald-700 dark:text-emerald-300"
                      : r.goalDifference < 0
                        ? "text-destructive"
                        : "text-muted-foreground",
                  )}
                >
                  {r.goalDifference > 0 ? "+" : ""}
                  {r.goalDifference}
                </td>
                <td
                  className={cn(
                    statCell,
                    "border-t border-border/60 group-hover:bg-primary/5",
                  )}
                >
                  <span className="inline-flex min-w-9 justify-center rounded-lg bg-primary/10 px-2.5 py-1.5 text-base font-bold text-primary">
                    {r.points}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t bg-muted/20 px-4 py-3 text-[10px] leading-relaxed text-muted-foreground">
        PJ: jugados · G: ganados · E: empatados · P: perdidos · GF/GC: goles a
        favor/en contra · DG: diferencia. En móvil, desliza para ver todas las
        columnas.
      </p>
    </div>
  );
}

type PlayerMetric = "goals" | "assists" | "yellowCards" | "redCards";
const playerMetrics: { key: PlayerMetric; label: string }[] = [
  { key: "goals", label: "Goles" },
  { key: "assists", label: "Asistencias" },
  { key: "yellowCards", label: "Amarillas" },
  { key: "redCards", label: "Rojas" },
];
export function RecordedPlayerStats({
  competition: c,
}: {
  competition: RecordedCompetition;
}) {
  const [sort, setSort] = useState<PlayerMetric>("goals");
  if (!c.players.length)
    return (
      <div className="rounded-2xl border border-dashed bg-muted/20 px-5 py-8 text-center">
        <Users
          className="mx-auto mb-3 size-8 text-muted-foreground/60"
          aria-hidden="true"
        />
        <h3 className="text-sm font-semibold">
          Aún no hay estadísticas individuales verificadas.
        </h3>
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
          Los goleadores, asistentes y las tarjetas aparecerán aquí cuando se
          contrasten las actas de los partidos.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {playerMetrics.map((m) => (
            <span
              key={m.key}
              className="rounded-full border bg-card px-3 py-1.5 text-[10px] text-muted-foreground"
            >
              {m.label} · Sin verificar
            </span>
          ))}
        </div>
      </div>
    );
  const players = [...c.players].sort(
    (a, b) => (b[sort] ?? -1) - (a[sort] ?? -1) || a.name.localeCompare(b.name),
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {players.length} jugador(es) con registros verificados
        </p>
        <label className="flex items-center gap-2 text-xs font-semibold">
          Ordenar por
          <select
            aria-label="Ordenar estadísticas de jugadores"
            className="min-h-10 rounded-lg border bg-background text-xs"
            value={sort}
            onChange={(e) => setSort(e.target.value as PlayerMetric)}
          >
            {playerMetrics.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="overflow-hidden rounded-2xl border shadow-sm">
        <div
          className="overflow-x-auto focus-visible:outline-primary"
          role="region"
          aria-label="Tabla de estadísticas, desplazable horizontalmente"
          tabIndex={0}
        >
          <table className="w-full min-w-[700px] border-separate border-spacing-0 text-sm">
            <caption className="bg-muted/30 px-4 py-3 text-left text-xs text-muted-foreground">
              Nombres transcritos de la evidencia, sin vincular homónimos
              automáticamente
            </caption>
            <thead className="bg-muted/60">
              <tr>
                <th
                  scope="col"
                  className={cn(
                    headerCell,
                    "sticky left-0 z-10 bg-muted text-left",
                  )}
                >
                  Jugador
                </th>
                <th scope="col" className={cn(headerCell, "text-left")}>
                  Equipo
                </th>
                {playerMetrics.map((m) => (
                  <th
                    key={m.key}
                    scope="col"
                    aria-sort={m.key === sort ? "descending" : undefined}
                    className={headerCell}
                  >
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={`${p.team}:${p.name}`} className="group">
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 w-32 min-w-32 border-t border-border/60 px-4 py-4 text-left text-[13px] group-hover:bg-accent sm:w-48 sm:min-w-44",
                      i % 2 ? "bg-muted" : "bg-card",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className="num flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] text-primary">
                        {p[sort] === null ? "—" : i + 1}
                      </span>
                      <span className="min-w-0 break-words">{p.name}</span>
                    </span>
                  </th>
                  <td className="min-w-40 border-t border-border/60 px-3 py-3 group-hover:bg-primary/5 sm:min-w-48">
                    <TeamIdentity name={p.team} />
                  </td>
                  {playerMetrics.map((m) => (
                    <td
                      key={m.key}
                      className={cn(
                        statCell,
                        "border-t border-border/60 group-hover:bg-primary/5",
                      )}
                    >
                      {p[m.key] === null ? (
                        <span
                          aria-label="Sin verificar"
                          className="text-muted-foreground"
                        >
                          —
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex min-w-8 justify-center rounded-md px-2 py-1 font-bold",
                            m.key === "goals"
                              ? "bg-primary/10 text-primary"
                              : m.key === "yellowCards"
                                ? "bg-amber-500/10 text-amber-800 dark:text-amber-200"
                                : m.key === "redCards"
                                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                                  : "bg-muted text-foreground",
                          )}
                        >
                          {p[m.key]}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t bg-muted/20 px-4 py-3 text-[10px] text-muted-foreground">
          «—» significa sin verificar; 0 es un valor confirmado. En móvil,
          desliza para consultar todas las estadísticas.
        </p>
      </div>
    </div>
  );
}
