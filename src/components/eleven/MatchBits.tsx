import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  FixtureView,
  MatchdayGroupView,
  StandingRowView,
} from "@/convex/appTypes";
import { Crest } from "./Crest";

/** Score chip: winner highlighted, numbers always legible (not colour-only). */
function ScoreChip({
  goals,
  points,
  won,
  lost,
}: {
  goals: number | null;
  points: number | null;
  won: boolean;
  lost: boolean;
}) {
  if (goals === null || points === null) {
    return (
      <span className="num display min-w-16 rounded-md bg-muted px-2 py-1 text-center text-sm text-muted-foreground">
        —
      </span>
    );
  }
  return (
    <span className="num display min-w-16 rounded-md px-2 py-1 text-center text-sm ring-1 ring-inset ring-border bg-card">
      <span className="font-bold">{goals}</span>
      <span
        className={cn(
          "ml-1 text-[11px] font-semibold",
          won ? "text-brand-bright" : lost ? "text-muted-foreground" : "text-foreground/70",
        )}
      >
        · {points}
      </span>
    </span>
  );
}

/**
 * One fixture row. The current matchday carries an "EN CURSO" marker; played
 * rows show goals + fantasy points; future rows show the kickoff date.
 */
export function MatchCard({
  fixture,
  highlightClubId,
  showMatchday = true,
}: {
  fixture: FixtureView;
  highlightClubId?: string | null;
  showMatchday?: boolean;
}) {
  const played = fixture.status === "jugado";
  const homeWon = played && (fixture.homeGoals ?? 0) > (fixture.awayGoals ?? 0);
  const awayWon = played && (fixture.awayGoals ?? 0) > (fixture.homeGoals ?? 0);
  const mine =
    highlightClubId != null &&
    (fixture.home.clubId === highlightClubId ||
      fixture.away.clubId === highlightClubId);

  const sideClass = (clubId: string) =>
    cn(
      "flex min-w-0 flex-1 items-center gap-2",
      clubId === fixture.away.clubId && "flex-row-reverse text-right",
      highlightClubId != null &&
        clubId === highlightClubId &&
        "font-bold text-foreground",
    );

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5",
        mine ? "border-primary/50 shadow-sm" : "border-border",
        fixture.status === "en_curso" && "border-primary/35 bg-primary/5",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className={sideClass(fixture.home.clubId)}>
          <span className="hidden min-w-9 text-[11px] font-semibold text-muted-foreground sm:block">
            {fixture.home.shortName}
          </span>
          <Crest
            name={fixture.home.name}
            shortName={fixture.home.shortName}
            colors={fixture.home.colors}
            size="sm"
          />
          <span className="truncate text-sm">{fixture.home.name}</span>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-0.5">
          {showMatchday ? (
            <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
              J{fixture.matchday}
            </span>
          ) : null}
          <div className="flex items-center gap-1.5">
            <ScoreChip
              goals={fixture.homeGoals}
              points={fixture.homePoints}
              won={homeWon}
              lost={awayWon}
            />
            <span className="display text-[10px] text-muted-foreground">VS</span>
            <ScoreChip
              goals={fixture.awayGoals}
              points={fixture.awayPoints}
              won={awayWon}
              lost={homeWon}
            />
          </div>
        </div>

        <div className={cn("flex min-w-0 flex-1 justify-end", "items-center")}>
          <div className={sideClass(fixture.away.clubId)}>
            <span className="truncate text-sm">{fixture.away.name}</span>
            <Crest
              name={fixture.away.name}
              shortName={fixture.away.shortName}
              colors={fixture.away.colors}
              size="sm"
            />
            <span className="hidden min-w-9 text-[11px] font-semibold text-muted-foreground sm:block">
              {fixture.away.shortName}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Matchday header chip: previous / current / next states at a glance. */
export function MatchdayChip({ group }: { group: MatchdayGroupView }) {
  const tone =
    group.status === "en_curso"
      ? "border-primary/50 bg-primary/10 text-primary"
      : group.status === "jugada"
        ? "border-border bg-muted text-muted-foreground"
        : "border-gold/40 bg-gold/10 text-amber-800 dark:text-amber-200";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        tone,
      )}
    >
      {group.statusLabel} · J{group.matchday}
    </span>
  );
}

/** Compact standings table with champion highlight and clear pos numbers. */
export function StandingsTable({
  rows,
  highlightClubId,
  maxRows,
}: {
  rows: StandingRowView[];
  highlightClubId?: string | null;
  maxRows?: number;
}) {
  const visible = maxRows ? rows.slice(0, maxRows) : rows;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="py-2 pr-2 font-semibold">#</th>
            <th scope="col" className="py-2 pr-2 font-semibold">Club</th>
            <th scope="col" className="py-2 text-center font-semibold">PJ</th>
            <th scope="col" className="py-2 text-center font-semibold">G</th>
            <th scope="col" className="py-2 text-center font-semibold">E</th>
            <th scope="col" className="py-2 text-center font-semibold">P</th>
            <th scope="col" className="py-2 text-center font-semibold">GF</th>
            <th scope="col" className="py-2 text-center font-semibold">GC</th>
            <th scope="col" className="py-2 text-center font-semibold">DIF</th>
            <th scope="col" className="py-2 pl-2 text-right font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr
              key={row.clubId}
              className={cn(
                "border-t border-border/70",
                row.clubId === highlightClubId && "bg-primary/5 font-semibold",
                row.position === 1 && "bg-gold/5",
              )}
            >
              <td className="py-2 pr-2">
                <span
                  className={cn(
                    "num display inline-flex size-6 items-center justify-center rounded-md text-xs font-bold",
                    row.position === 1
                      ? "bg-gold/20 text-amber-800 ring-1 ring-gold/40 dark:text-amber-200"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {row.position}
                </span>
              </td>
              <td className="py-2 pr-2">
                <span className="flex items-center gap-2">
                  <Crest
                    name={row.clubName}
                    shortName={row.clubShortName}
                    colors={row.clubColors}
                    size="sm"
                    className="size-6 text-[8px]"
                  />
                  <span className="truncate">{row.clubName}</span>
                  {row.position === 1 ? (
                    <Trophy
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-amber-500"
                    />
                  ) : null}
                </span>
              </td>
              <td className="num py-2 text-center text-muted-foreground">
                {row.played}
              </td>
              <td className="num py-2 text-center">{row.won}</td>
              <td className="num py-2 text-center">{row.drawn}</td>
              <td className="num py-2 text-center">{row.lost}</td>
              <td className="num py-2 text-center text-muted-foreground">
                {row.goalsFor}
              </td>
              <td className="num py-2 text-center text-muted-foreground">
                {row.goalsAgainst}
              </td>
              <td
                className={cn(
                  "num py-2 text-center font-semibold",
                  row.goalDiff > 0
                    ? "text-brand-bright"
                    : row.goalDiff < 0
                      ? "text-destructive"
                      : "text-muted-foreground",
                )}
              >
                {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
              </td>
              <td className="num display py-2 pl-2 text-right text-base font-bold">
                {row.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
