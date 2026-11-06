import { useEffect, useState } from "react";
import { getCompetitionArchive } from "@/services/backend/competition-records";
import type { RecordedCompetition } from "@/domain/competition-records";
import { errorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/eleven/SectionCard";
import { Trophy, Swords, BarChart3, Users } from "lucide-react";
import {
  RecordedResults,
  RecordedStandings,
  RecordedPlayerStats,
} from "./CompetitionTables";

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
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                Centro de competiciones
              </p>
              <h3 className="display mt-1 text-2xl font-bold">{c.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Temporada {c.season}
              </p>
            </div>
            <label className="w-full text-xs font-semibold sm:w-64">
              Elegir competición
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
          </div>
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
            <details className="rounded-xl border bg-muted/20 p-3 text-xs">
              <summary className="cursor-pointer font-semibold text-muted-foreground">
                Jornadas y cobertura del archivo
              </summary>
              <div className="mt-3 flex flex-wrap gap-2">
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
            </details>
          ) : (
            <p className="text-xs text-muted-foreground">
              Las fases y los cruces se completarán con evidencia; no se han
              inventado emparejamientos.
            </p>
          )}
          <div
            className="flex gap-1 rounded-xl border bg-muted/40 p-1"
            role="group"
            aria-label="Vista de la competición"
          >
            {[
              { value: "matches", label: "Resultados", Icon: Swords },
              { value: "standings", label: "Clasificación", Icon: BarChart3 },
              {
                value: "players",
                label: "Estadísticas de jugadores",
                Icon: Users,
              },
            ].map(({ value, label, Icon }) => (
              <Button
                key={value}
                type="button"
                variant={view === value ? "default" : "ghost"}
                className="min-h-11 min-w-0 flex-1 gap-1.5 whitespace-normal rounded-lg px-2 text-[11px] sm:text-sm"
                aria-pressed={view === value}
                onClick={() => setView(value)}
              >
                <Icon
                  className="hidden size-4 shrink-0 sm:block"
                  aria-hidden="true"
                />
                {label}
              </Button>
            ))}
          </div>
          {view === "matches" ? (
            <RecordedResults key={c.id} competition={c} />
          ) : null}
          {view === "standings" ? <RecordedStandings competition={c} /> : null}
          {view === "players" ? (
            <RecordedPlayerStats key={c.id} competition={c} />
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}
