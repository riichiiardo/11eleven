import { useMemo } from "react";
import type { AppStateView, FixtureView } from "@/convex/appTypes";
import { useOutletContext } from "react-router";
import { SectionCard, Countdown } from "@/components/eleven/SectionCard";
import {
  MatchCard,
  MatchdayChip,
  StandingsTable,
} from "@/components/eleven/MatchBits";
import { Crest } from "@/components/eleven/Crest";
import {
  CalendarDays,
  History,
  Info,
  Swords,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DATE_FORMAT = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function roundDate(kickoffAt: number): string {
  return DATE_FORMAT.format(new Date(kickoffAt));
}

/**
 * Resultados (prompt §25): marcador + puntos fantasy, tabla completa and the
 * Match Center (§58): my fixture, XI OVR, kickoff and the deadline anchor.
 */
export default function Competition() {
  const state = useOutletContext<AppStateView>();
  const summary = state.competition;

  const myClubId = state.club?.id ?? null;
  const fixtureGroups = summary.matchdays;

  const [previous, current, upcoming] = useMemo(() => {
    const currentIdx = fixtureGroups.findIndex(
      (group) => group.status === "en_curso",
    );
    const idx = currentIdx >= 0 ? currentIdx : summary.currentMatchday - 1;
    return [
      fixtureGroups[idx - 1] ?? null,
      fixtureGroups[idx] ?? null,
      fixtureGroups[idx + 1] ?? null,
    ];
  }, [fixtureGroups, summary.currentMatchday]);

  if (!summary.available) {
    return (
      <SectionCard title="Calendario" icon={CalendarDays}>
        <p className="text-sm text-muted-foreground">
          El calendario todavía no se ha generado. Se crea automáticamente con el
          torneo (ida y vuelta entre todos los clubes); recarga la página en
          unos segundos.
        </p>
      </SectionCard>
    );
  }

  const currentRows = current?.fixtures ?? [];

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------ Match Center */}
      <SectionCard
        title="Match Center"
        icon={Swords}
        action={{ label: "Ver alineación", to: "/dashboard/formacion" }}
      >
        {summary.myMatch ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-4 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:flex-row sm:justify-between">
              <MatchSide
                name={state.club?.name ?? "—"}
                shortName={state.club?.shortName ?? "—"}
                colors={[
                  state.club?.colorPrimary ?? "#1d4ed8",
                  state.club?.colorSecondary ?? "#0b1a30",
                ]}
                points={
                  summary.myMatch.mySide === "home"
                    ? summary.myMatch.fixture.homePoints
                    : summary.myMatch.fixture.awayPoints
                }
                xiOvr={summary.myMatch.myXiOvr}
                lineup={state.lineup?.formation}
              />
              <div className="flex flex-col items-center gap-1">
                <span className="display text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Jornada {summary.myMatch.matchday}
                </span>
                {summary.myMatch.status === "jugada" ? (
                  <span className="num display text-2xl font-bold">
                    {(summary.myMatch.mySide === "home"
                      ? summary.myMatch.fixture.homeGoals
                      : summary.myMatch.fixture.awayGoals) ?? "—"}
                    <span className="mx-2 text-sm text-muted-foreground">–</span>
                    {(summary.myMatch.mySide === "away"
                      ? summary.myMatch.fixture.homeGoals
                      : summary.myMatch.fixture.awayGoals) ?? "—"}
                  </span>
                ) : (
                  <>
                    <span className="display text-xl font-bold text-primary">
                      VS
                    </span>
                    {summary.myMatch.status === "en_curso" ? (
                      <Countdown
                        target={summary.myMatch.fixture.kickoffAt}
                        label="Arranca en"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {roundDate(summary.myMatch.fixture.kickoffAt)}
                      </span>
                    )}
                  </>
                )}
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {summary.myMatch.status === "en_curso"
                    ? "EN CURSO"
                    : summary.myMatch.status === "jugada"
                      ? "FINAL"
                      : "PROGRAMADO"}
                </span>
              </div>
              <MatchSide
                name={
                  summary.myMatch.fixture.away.clubId === myClubId
                    ? summary.myMatch.fixture.home.name
                    : summary.myMatch.fixture.away.name
                }
                shortName={
                  summary.myMatch.fixture.away.clubId === myClubId
                    ? summary.myMatch.fixture.home.shortName
                    : summary.myMatch.fixture.away.shortName
                }
                colors={
                  summary.myMatch.fixture.away.clubId === myClubId
                    ? summary.myMatch.fixture.home.colors
                    : summary.myMatch.fixture.away.colors
                }
                points={
                  summary.myMatch.mySide === "home"
                    ? summary.myMatch.fixture.awayPoints
                    : summary.myMatch.fixture.homePoints
                }
                xiOvr={
                  summary.myMatch.mySide === "home"
                    ? summary.myMatch.fixture.awayXiOvr
                    : summary.myMatch.fixture.homeXiOvr
                }
                rival={summary.myMatch.rivalNickname}
                align="right"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.myMatch.status === "jugada"
                ? "Los 11 titulares guardados al cierre puntuaron en el marcador. Los fichajes posteriores no reescriben la historia."
                : "Puntúan los 11 titulares guardados en Formación al momento del cierre de la jornada."}
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-4">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {myClubId
                ? "Tu club no tiene partido en la jornada en curso."
                : "Elige un club para ver tu partido de la jornada."}
            </p>
          </div>
        )}
      </SectionCard>

      {/* ------------------------------------------------- Jornada cards */}
      <div className="grid gap-5 lg:grid-cols-2">
        {[
          { group: previous, title: "Jornada anterior", icon: History },
          { group: upcoming, title: "Próxima jornada", icon: CalendarDays },
        ]
          .filter((block) => block.group)
          .map(({ group, title, icon: Icon }) => (
            <SectionCard key={title} title={title} icon={Icon}>
              <div className="flex flex-col gap-2">
                <MatchdayChip group={group!} />
                {group!.fixtures.map((fixture) => (
                  <MatchCard
                    key={fixture.id}
                    fixture={fixture}
                    highlightClubId={myClubId}
                  />
                ))}
              </div>
            </SectionCard>
          ))}
      </div>

      {/* ------------------------------------------- Current matchday */}
      <SectionCard
        title={`Jornada ${current?.matchday ?? summary.currentMatchday}`}
        icon={Swords}
      >
        <div className="flex flex-col gap-2">
          {current ? <MatchdayChip group={current} /> : null}
          {currentRows.length > 0 ? (
            currentRows.map((fixture) => (
              <MatchCard
                key={fixture.id}
                fixture={fixture}
                highlightClubId={myClubId}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin partidos programados.
            </p>
          )}
        </div>
      </SectionCard>

      {/* --------------------------------------------------- Standings */}
      <SectionCard title="Tabla del torneo" icon={Trophy}>
        <StandingsTable rows={summary.standings} highlightClubId={myClubId} />
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground">PJ</strong> jugados ·{" "}
            <strong className="text-foreground">G</strong> victorias ·{" "}
            <strong className="text-foreground">E</strong> empates ·{" "}
            <strong className="text-foreground">P</strong> derrotas
          </span>
          <span>
            <strong className="text-foreground">GF/GC</strong> goles a favor y en
            contra · <strong className="text-foreground">DIF</strong> diferencia
          </span>
          <span>Orden: puntos, diferencia, goles, puntos fantasy</span>
        </div>
      </SectionCard>
    </div>
  );
}

function MatchSide({
  name,
  shortName,
  colors,
  points,
  xiOvr,
  lineup,
  rival,
  align = "left",
}: {
  name: string;
  shortName: string;
  colors: [string, string];
  points: number | null;
  xiOvr: number | null;
  lineup?: string;
  rival?: string | null;
  align?: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-1.5",
        align === "right" && "items-end text-right",
      )}
    >
      <Crest name={name} shortName={shortName} colors={colors} size="lg" />
      <span className="display truncate text-base font-bold">{name}</span>
      {rival ? (
        <span className="text-xs text-muted-foreground">{rival}</span>
      ) : lineup ? (
        <span className="text-xs text-muted-foreground">{lineup}</span>
      ) : null}
      <div className="flex items-center gap-2 text-xs">
        {xiOvr != null ? (
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-semibold">
            OVR {xiOvr}
          </span>
        ) : null}
        {points != null ? (
          <span className="num rounded-md bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
            {points} pts
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Matchday strip used by Home: previous / current / next at a glance. */
export function MatchdayStrip({
  previous,
  current,
  upcoming,
  myClubId,
}: {
  previous: FixtureView[];
  current: FixtureView[];
  upcoming: FixtureView[];
  myClubId: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      {[
        { label: "Jornada anterior", fixtures: previous },
        { label: "Jornada actual", fixtures: current },
        { label: "Próxima jornada", fixtures: upcoming },
      ].map(({ label, fixtures }) =>
        fixtures.length > 0 ? (
          <div key={label}>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <div className="flex flex-col gap-1.5">
              {fixtures.map((fixture) => (
                <MatchCard
                  key={fixture.id}
                  fixture={fixture}
                  highlightClubId={myClubId}
                  showMatchday={false}
                />
              ))}
            </div>
          </div>
        ) : null,
      )}
      {previous.length === 0 &&
      current.length === 0 &&
      upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay partidos que mostrar.
        </p>
      ) : null}
    </div>
  );
}
