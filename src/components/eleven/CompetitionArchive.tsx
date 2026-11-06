import { useEffect, useState } from "react";
import { getCompetitionArchive } from "@/services/backend/competition-records";
import type {
  RecordedCompetition,
  RecordedStat,
} from "@/domain/competition-records";
import { errorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/eleven/SectionCard";
import { Trophy } from "lucide-react";

export function CompetitionArchive({
  universeId,
  scope,
}: {
  universeId: string;
  scope: string;
}) {
  return (
    <ArchiveLoader key={`${scope}:${universeId}`} universeId={universeId} />
  );
}
function ArchiveLoader({ universeId }: { universeId: string }) {
  const [data, setData] = useState<RecordedCompetition[] | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true,
      pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const next = await getCompetitionArchive(universeId);
        if (active) {
          setData(next);
          setError("");
        }
      } catch (e) {
        if (active) setError(errorMessage(e));
      } finally {
        pending = false;
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 30000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [universeId, retry]);
  return (
    <CompetitionArchiveView
      data={data}
      error={error}
      onRetry={() => setRetry((n) => n + 1)}
    />
  );
}
export function CompetitionArchiveView({
  data,
  error,
  onRetry,
}: {
  data: RecordedCompetition[] | null;
  error?: string;
  onRetry?: () => void;
}) {
  const [selected, setSelected] = useState("");
  const c =
    data?.find((item) => item.id === selected) ??
    data?.find((item) => item.slug === "primera") ??
    data?.[0];
  const [view, setView] = useState("matches");
  const evidence = (videoId: string, second: number) => {
    window.dispatchEvent(
      new CustomEvent("eleven:broadcast-video", {
        detail: { videoId, second },
      }),
    );
    document
      .getElementById("transmision")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const stats = (
    rows: RecordedStat[] | null,
    homeId: string,
    home: string,
    away: string,
  ) =>
    rows === null
      ? "Sin verificar"
      : rows.length === 0
        ? "Ninguno, según el reporte"
        : rows.map((r, i) => (
            <span key={i} className="block">
              {r.teamId === homeId ? home : away}: {r.player} ×{r.count}
              {r.ownGoal ? " (autogol)" : ""}
            </span>
          ));
  return (
    <SectionCard title="Competiciones del Universo" icon={Trophy}>
      {error ? (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-amber-500/40 p-3 text-sm"
        >
          No se pudieron actualizar las competiciones: {error}{" "}
          <Button type="button" variant="outline" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      ) : null}
      {data === null && !error ? (
        <p role="status">Cargando competiciones…</p>
      ) : null}
      {data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este Universo todavía no tiene competiciones registradas.
        </p>
      ) : null}
      {c ? (
        <div className="flex flex-col gap-4">
          <label className="text-sm font-semibold">
            Competición
            <select
              aria-label="Competición del Universo"
              value={c.id}
              onChange={(e) => {
                setSelected(e.target.value);
                setView("matches");
              }}
              className="mt-1 min-h-11 w-full rounded-md border bg-background py-2 pl-3 pr-10"
            >
              {data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.season}
                </option>
              ))}
            </select>
          </label>
          <p
            role="note"
            className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"
          >
            Registro parcial. Solo cuentan los partidos con marcador verificado.
            Las jornadas anteriores sin archivo siguen pendientes y no se
            contabilizan como empates ni partidos jugados. Las estadísticas
            desconocidas se muestran con «—» o «Sin verificar».
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span>{c.videoCount} grabación(es) localizadas</span>
            <span>· {c.verifiedMatches} partido(s) verificado(s)</span>
            <span>
              ·{" "}
              {c.format === "cup"
                ? "Copa: encuentros por fase"
                : c.format === "league_playoffs"
                  ? "Liga con fase final"
                  : "Liga"}
            </span>
          </div>
          {c.latestRound ? (
            <div className="flex flex-wrap gap-2">
              {Array.from(
                { length: Math.min(c.latestRound, 100) },
                (_, i) => i + 1,
              ).map((round) => {
                const count = c.matches.filter(
                  (m) => m.round === round && m.verified,
                ).length;
                return (
                  <span
                    key={round}
                    className="rounded border px-2 py-1 text-xs"
                  >
                    J{round}:{" "}
                    {count
                      ? `${count} verificado(s)`
                      : c.reviewFrom !== null && round < c.reviewFrom
                        ? "pendiente de archivo"
                        : "pendiente de revisión"}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Las fases y los cruces se completarán con evidencia; no se han
              inventado emparejamientos.
            </p>
          )}
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Vista de la competición"
          >
            {[
              ["matches", "Resultados"],
              ["standings", "Clasificación"],
              ["players", "Estadísticas de jugadores"],
            ].map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={view === value ? "default" : "outline"}
                aria-pressed={view === value}
                onClick={() => setView(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          {view === "matches" ? (
            c.matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay resultados revisados. Las grabaciones localizadas no
                se convierten automáticamente en resultados.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {c.matches.map((m) => (
                  <article key={m.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-semibold">
                      {m.round ? `J${m.round} · ` : ""}
                      {m.stage} · {m.home} {m.homeGoals ?? "—"}–
                      {m.awayGoals ?? "—"} {m.away}
                      {m.verified
                        ? " · Verificado"
                        : " · Pendiente de verificar"}
                    </p>
                    {m.homePenalties !== null ? (
                      <p>
                        Penaltis: {m.homePenalties}–{m.awayPenalties} (fuera del
                        marcador)
                      </p>
                    ) : null}
                    <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                      {[
                        ["Goles", m.goals],
                        ["Asistencias", m.assists],
                        ["Amarillas", m.yellowCards],
                        ["Rojas", m.redCards],
                      ].map(([label, rows]) => (
                        <div key={String(label)}>
                          <dt className="font-semibold">{String(label)}</dt>
                          <dd className="text-muted-foreground">
                            {stats(
                              rows as RecordedStat[] | null,
                              m.homeId,
                              m.home,
                              m.away,
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <Button
                      type="button"
                      className="mt-3"
                      variant="outline"
                      onClick={() => evidence(m.videoId, m.evidenceSecond)}
                    >
                      Ver evidencia dentro de la app
                    </Button>
                  </article>
                ))}
              </div>
            )
          ) : null}
          {view === "standings" ? (
            c.format === "cup" ? (
              <p className="text-sm text-muted-foreground">
                Esta copa se consulta por fases y resultados; no se mezclan sus
                encuentros con los puntos de las ligas.
              </p>
            ) : c.standings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin clasificación calculable: todavía no hay partidos
                verificados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[550px] text-sm">
                  <caption className="mb-2 text-left">
                    Clasificación provisional · solo partidos verificados
                  </caption>
                  <thead>
                    <tr>
                      {[
                        "Equipo",
                        "PJ",
                        "G",
                        "E",
                        "P",
                        "GF",
                        "GC",
                        "DG",
                        "Pts",
                      ].map((h) => (
                        <th key={h} scope="col" className="p-2 text-left">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {c.standings.map((r) => (
                      <tr key={r.team} className="border-t">
                        {[
                          r.team,
                          r.played,
                          r.won,
                          r.drawn,
                          r.lost,
                          r.goalsFor,
                          r.goalsAgainst,
                          r.goalDifference,
                          r.points,
                        ].map((v, i) => (
                          <td key={i} className="p-2">
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
          {view === "players" ? (
            c.players.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay estadísticas individuales verificadas.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-sm">
                  <caption className="mb-2 text-left">
                    Nombres transcritos de la evidencia, sin vincular homónimos
                    automáticamente
                  </caption>
                  <thead>
                    <tr>
                      {[
                        "Jugador",
                        "Equipo",
                        "Goles",
                        "Asistencias",
                        "Amarillas",
                        "Rojas",
                      ].map((h) => (
                        <th key={h} scope="col" className="p-2 text-left">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {c.players.map((p, i) => (
                      <tr key={i} className="border-t">
                        {[
                          p.name,
                          p.team,
                          p.goals ?? "—",
                          p.assists ?? "—",
                          p.yellowCards ?? "—",
                          p.redCards ?? "—",
                        ].map((v, j) => (
                          <td key={j} className="p-2">
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}
