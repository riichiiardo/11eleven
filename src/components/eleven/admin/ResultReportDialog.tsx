import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FixtureReportSideView, FixtureReportView, FixtureView } from "@/convex/appTypes";
import { errorMessage } from "@/lib/errors";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Save, Stethoscope, X } from "lucide-react";
import { cn } from "@/lib/utils";

type GoalEntry = { clubId: Id<"clubs">; playerId: Id<"players">; name: string; count: number };
type CardEntry = { clubId: Id<"clubs">; playerId: Id<"players">; name: string };
type InjuryEntry = {
  clubId: Id<"clubs">;
  playerId: Id<"players">;
  name: string;
  matchdays: number;
};

/** Cards are one row each; this groups them per player with a count. */
function grouped<T extends { playerId: Id<"players">; name: string }>(rows: T[]) {
  const map = new Map<string, { playerId: Id<"players">; name: string; count: number }>();
  for (const row of rows) {
    const current = map.get(row.playerId as string);
    if (current) current.count += 1;
    else map.set(row.playerId as string, { playerId: row.playerId, name: row.name, count: 1 });
  }
  return [...map.values()];
}

/**
 * "Modo árbitro" for a single match: the Administrator/Co-Administrator enters
 * the final score, the goals per player, yellow/red cards per player and the
 * injured players with how many matchdays they will be out.
 */
export function ResultReportButton({ fixture }: { fixture: FixtureView }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-9 shrink-0"
        onClick={() => setOpen(true)}
      >
        <Save className="size-3.5" aria-hidden="true" />
        {fixture.status === "jugado" ? "Corregir resultado" : "Registrar resultado"}
      </Button>
      {open ? <ResultReportDialog fixture={fixture} open onOpenChange={setOpen} /> : null}
    </>
  );
}

function ResultReportDialog({
  fixture,
  open,
  onOpenChange,
}: {
  fixture: FixtureView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const data = useQuery(api.adminOps.fixtureReport, { fixtureId: fixture.id });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="display">Resultado detallado del partido</DialogTitle>
          <DialogDescription>
            Jornada {fixture.matchday} · {fixture.home.name} vs {fixture.away.name}. Marca el
            marcador y desglosa goles, tarjetas y lesiones por jugador.
          </DialogDescription>
        </DialogHeader>

        {data === undefined ? (
          <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Cargando las plantillas del partido…
          </div>
        ) : data === null ? (
          <p className="rounded-lg border border-amber-500/35 bg-amber-500/[0.07] p-3 text-xs text-amber-800 dark:text-amber-200">
            Este partido ya no existe en la liga.
          </p>
        ) : (
          <ReportForm
            fixture={fixture}
            data={data}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReportForm({
  fixture,
  data,
  onDone,
}: {
  fixture: FixtureView;
  data: FixtureReportView;
  onDone: () => void;
}) {
  const submit = useMutation(api.adminOps.reportFixture);
  const existing = data.report;

  const [homeGoals, setHomeGoals] = useState(existing?.homeGoals ?? 0);
  const [awayGoals, setAwayGoals] = useState(existing?.awayGoals ?? 0);
  const [goals, setGoals] = useState<GoalEntry[]>(() =>
    (existing?.goals ?? []).map((entry) => ({
      clubId: entry.clubId,
      playerId: entry.playerId,
      name: entry.name,
      count: entry.count,
    })),
  );
  const [yellows, setYellows] = useState<CardEntry[]>(() =>
    (existing?.yellowCards ?? []).map((entry) => ({
      clubId: entry.clubId,
      playerId: entry.playerId,
      name: entry.name,
    })),
  );
  const [reds, setReds] = useState<CardEntry[]>(() =>
    (existing?.redCards ?? []).map((entry) => ({
      clubId: entry.clubId,
      playerId: entry.playerId,
      name: entry.name,
    })),
  );
  const [injuries, setInjuries] = useState<InjuryEntry[]>(() =>
    (existing?.injuries ?? []).map((entry) => ({
      clubId: entry.clubId,
      playerId: entry.playerId,
      name: entry.name,
      matchdays: entry.matchdays,
    })),
  );
  const [selectedHome, setSelectedHome] = useState("");
  const [selectedAway, setSelectedAway] = useState("");
  const [injuryDays, setInjuryDays] = useState(2);
  const [busy, setBusy] = useState(false);

  const homeClubId = fixture.home.clubId;
  const awayClubId = fixture.away.clubId;

  const forClub = <T,>(rows: T[], clubId: Id<"clubs">) =>
    rows.filter((row) => (row as { clubId: Id<"clubs"> }).clubId === clubId);

  const homeGoalSum = forClub(goals, homeClubId).reduce((sum, goal) => sum + goal.count, 0);
  const awayGoalSum = forClub(goals, awayClubId).reduce((sum, goal) => sum + goal.count, 0);

  const canSave =
    (data.home.players.length === 0 || homeGoalSum === homeGoals) &&
    (data.away.players.length === 0 || awayGoalSum === awayGoals);

  const save = async () => {
    setBusy(true);
    try {
      const result = await submit({
        fixtureId: fixture.id,
        homeGoals,
        awayGoals,
        goals: goals.map((entry) => ({
          clubId: entry.clubId,
          playerId: entry.playerId,
          count: entry.count,
        })),
        yellowCards: yellows.map((entry) => ({ clubId: entry.clubId, playerId: entry.playerId })),
        redCards: reds.map((entry) => ({ clubId: entry.clubId, playerId: entry.playerId })),
        injuries: injuries.map((entry) => ({
          clubId: entry.clubId,
          playerId: entry.playerId,
          matchdays: entry.matchdays,
        })),
      });
      toast.success("Resultado registrado", {
        description: `${fixture.home.name} ${result.homeGoals}–${result.awayGoals} ${fixture.away.name}${result.injured ? ` · ${result.injured} jugador(es) lesionado(s)` : ""}.`,
      });
      onDone();
    } catch (cause) {
      toast.error("No se pudo registrar el resultado", {
        description: errorMessage(cause),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <SideScore label={fixture.home.name} value={homeGoals} onChange={setHomeGoals} />
        <span className="display pb-2 text-center text-xl text-muted-foreground">–</span>
        <SideScore label={fixture.away.name} value={awayGoals} onChange={setAwayGoals} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SideColumn
          title={fixture.home.name}
          side={data.home}
          goals={forClub(goals, homeClubId)}
          yellows={forClub(yellows, homeClubId)}
          reds={forClub(reds, homeClubId)}
          injuries={forClub(injuries, homeClubId)}
          selection={selectedHome}
          setSelection={setSelectedHome}
          injuryDays={injuryDays}
          setInjuryDays={setInjuryDays}
          onAddGoal={(playerId, name) =>
            setGoals((previous) => {
              const existingGoal = previous.find(
                (entry) => entry.playerId === playerId && entry.clubId === homeClubId,
              );
              if (existingGoal) {
                return previous.map((entry) =>
                  entry === existingGoal ? { ...entry, count: entry.count + 1 } : entry,
                );
              }
              return [...previous, { clubId: homeClubId, playerId, name, count: 1 }];
            })
          }
          onBumpGoal={(playerId, delta) =>
            setGoals((previous) =>
              previous
                .map((entry) =>
                  entry.playerId === playerId && entry.clubId === homeClubId
                    ? { ...entry, count: entry.count + delta }
                    : entry,
                )
                .filter((entry) => entry.count > 0),
            )
          }
          onAddCard={(kind, playerId, name) => {
            const row = { clubId: homeClubId, playerId, name };
            if (kind === "amarilla") setYellows((previous) => [...previous, row]);
            else setReds((previous) => [...previous, row]);
          }}
          onRemoveCard={(kind, playerId) => {
            if (kind === "amarilla") {
              setYellows((previous) => {
                const index = previous.findIndex(
                  (entry) => entry.playerId === playerId && entry.clubId === homeClubId,
                );
                return previous.filter((_, position) => position !== index);
              });
            } else {
              setReds((previous) => {
                const index = previous.findIndex(
                  (entry) => entry.playerId === playerId && entry.clubId === homeClubId,
                );
                return previous.filter((_, position) => position !== index);
              });
            }
          }}
          onAddInjury={(playerId, name) =>
            setInjuries((previous) => [
              ...previous.filter(
                (entry) => !(entry.playerId === playerId && entry.clubId === homeClubId),
              ),
              { clubId: homeClubId, playerId, name, matchdays: injuryDays },
            ])
          }
          onRemoveInjury={(playerId) =>
            setInjuries((previous) =>
              previous.filter(
                (entry) => !(entry.playerId === playerId && entry.clubId === homeClubId),
              ),
            )
          }
          goalSum={homeGoalSum}
          score={homeGoals}
        />

        <SideColumn
          title={fixture.away.name}
          side={data.away}
          goals={forClub(goals, awayClubId)}
          yellows={forClub(yellows, awayClubId)}
          reds={forClub(reds, awayClubId)}
          injuries={forClub(injuries, awayClubId)}
          selection={selectedAway}
          setSelection={setSelectedAway}
          injuryDays={injuryDays}
          setInjuryDays={setInjuryDays}
          onAddGoal={(playerId, name) =>
            setGoals((previous) => {
              const existingGoal = previous.find(
                (entry) => entry.playerId === playerId && entry.clubId === awayClubId,
              );
              if (existingGoal) {
                return previous.map((entry) =>
                  entry === existingGoal ? { ...entry, count: entry.count + 1 } : entry,
                );
              }
              return [...previous, { clubId: awayClubId, playerId, name, count: 1 }];
            })
          }
          onBumpGoal={(playerId, delta) =>
            setGoals((previous) =>
              previous
                .map((entry) =>
                  entry.playerId === playerId && entry.clubId === awayClubId
                    ? { ...entry, count: entry.count + delta }
                    : entry,
                )
                .filter((entry) => entry.count > 0),
            )
          }
          onAddCard={(kind, playerId, name) => {
            const row = { clubId: awayClubId, playerId, name };
            if (kind === "amarilla") setYellows((previous) => [...previous, row]);
            else setReds((previous) => [...previous, row]);
          }}
          onRemoveCard={(kind, playerId) => {
            if (kind === "amarilla") {
              setYellows((previous) => {
                const index = previous.findIndex(
                  (entry) => entry.playerId === playerId && entry.clubId === awayClubId,
                );
                return previous.filter((_, position) => position !== index);
              });
            } else {
              setReds((previous) => {
                const index = previous.findIndex(
                  (entry) => entry.playerId === playerId && entry.clubId === awayClubId,
                );
                return previous.filter((_, position) => position !== index);
              });
            }
          }}
          onAddInjury={(playerId, name) =>
            setInjuries((previous) => [
              ...previous.filter(
                (entry) => !(entry.playerId === playerId && entry.clubId === awayClubId),
              ),
              { clubId: awayClubId, playerId, name, matchdays: injuryDays },
            ])
          }
          onRemoveInjury={(playerId) =>
            setInjuries((previous) =>
              previous.filter(
                (entry) => !(entry.playerId === playerId && entry.clubId === awayClubId),
              ),
            )
          }
          goalSum={awayGoalSum}
          score={awayGoals}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="min-h-11"
          disabled={busy || !canSave}
          onClick={() => void save()}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          Guardar resultado
        </Button>
        <p className="text-[11px] text-muted-foreground">
          {canSave
            ? existing
              ? "Se actualizará el resultado detallado existente."
              : "Se publicará en la tabla del torneo y la auditoría."
            : `Los goles por jugador deben sumar el marcador (${homeGoalSum}/${homeGoals} local · ${awayGoalSum}/${awayGoals} visitante).`}
        </p>
      </div>
    </div>
  );
}

function SideScore({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="truncate text-xs font-semibold">{label}</span>
      <Input
        type="number"
        min={0}
        max={30}
        aria-label={`Goles de ${label}`}
        className="h-12 display text-center text-2xl"
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
      />
    </div>
  );
}

function SideColumn({
  title,
  side,
  goals,
  yellows,
  reds,
  injuries,
  selection,
  setSelection,
  injuryDays,
  setInjuryDays,
  onAddGoal,
  onBumpGoal,
  onAddCard,
  onRemoveCard,
  onAddInjury,
  onRemoveInjury,
  goalSum,
  score,
}: {
  title: string;
  side: FixtureReportSideView;
  goals: GoalEntry[];
  yellows: CardEntry[];
  reds: CardEntry[];
  injuries: InjuryEntry[];
  selection: string;
  setSelection: (value: string) => void;
  injuryDays: number;
  setInjuryDays: (value: number) => void;
  onAddGoal: (playerId: Id<"players">, name: string) => void;
  onBumpGoal: (playerId: Id<"players">, delta: number) => void;
  onAddCard: (kind: "amarilla" | "roja", playerId: Id<"players">, name: string) => void;
  onRemoveCard: (kind: "amarilla" | "roja", playerId: Id<"players">) => void;
  onAddInjury: (playerId: Id<"players">, name: string) => void;
  onRemoveInjury: (playerId: Id<"players">) => void;
  goalSum: number;
  score: number;
}) {
  const goalChips = useMemo(() => grouped(goals), [goals]);
  const yellowChips = useMemo(() => grouped(yellows), [yellows]);
  const redChips = useMemo(() => grouped(reds), [reds]);
  const injuryChips = useMemo(
    () =>
      injuries.map((entry) => ({
        playerId: entry.playerId,
        name: entry.name,
        matchdays: entry.matchdays,
      })),
    [injuries],
  );

  const selectedName = side.players.find((player) => player.playerId === selection)?.name ?? "";

  const playerSelect = (
    <Select value={selection} onValueChange={setSelection}>
      <SelectTrigger className="h-10 min-w-0" aria-label={`Jugador de ${title}`}>
        <SelectValue placeholder="Selecciona un jugador" />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {side.players.length === 0 ? (
          <SelectItem value="none" disabled>
            Sin jugadores en la plantilla
          </SelectItem>
        ) : (
          side.players.map((player) => (
            <SelectItem key={player.playerId} value={player.playerId}>
              {player.name}
              <span className="text-muted-foreground">
                {" "}
                · {player.position} · {player.ovr} OVR
              </span>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );

  const canAct = selection !== "" && selection !== "none";

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-3">
      <header className="flex items-center justify-between gap-2">
        <h4 className="display truncate text-sm">{title}</h4>
        <span
          className={cn(
            "num rounded-md px-2 py-0.5 text-[11px] font-bold",
            goalSum === score
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
          )}
        >
          {goalSum}/{score} goles asignados
        </span>
      </header>

      {/* Goals */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Goles por jugador
        </span>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">{playerSelect}</div>
          <Button
            type="button"
            variant="outline"
            className="h-10 shrink-0"
            disabled={!canAct}
            onClick={() => {
              const player = side.players.find((row) => row.playerId === selection);
              if (player) onAddGoal(player.playerId, player.name);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Gol
          </Button>
        </div>
        {goalChips.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {goalChips.map((chip) => (
              <li
                key={chip.playerId}
                className="flex items-center gap-1 rounded-md border bg-muted/50 px-1.5 py-1 text-[11px]"
              >
                <span className="font-semibold">{chip.name}</span>
                <span className="num font-bold text-primary">×{chip.count}</span>
                <button
                  type="button"
                  aria-label={`Quitar un gol de ${chip.name}`}
                  className="rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => onBumpGoal(chip.playerId, -1)}
                >
                  −
                </button>
                <button
                  type="button"
                  aria-label={`Añadir un gol de ${chip.name}`}
                  className="rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => onBumpGoal(chip.playerId, 1)}
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-muted-foreground">Sin goles asignados todavía.</p>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Tarjetas por jugador
        </span>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={!canAct}
            onClick={() => {
              const player = side.players.find((row) => row.playerId === selection);
              if (player) onAddCard("amarilla", player.playerId, player.name);
            }}
          >
            <span aria-hidden="true" className="size-3 rounded-sm bg-amber-400" />
            Amarilla
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={!canAct}
            onClick={() => {
              const player = side.players.find((row) => row.playerId === selection);
              if (player) onAddCard("roja", player.playerId, player.name);
            }}
          >
            <span aria-hidden="true" className="size-3 rounded-sm bg-rose-600" />
            Roja
          </Button>
        </div>
        {yellowChips.length + redChips.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {yellowChips.map((chip) => (
              <li
                key={`y-${chip.playerId}`}
                className="flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-1 text-[11px]"
              >
                <span aria-hidden="true" className="size-2.5 rounded-sm bg-amber-400" />
                <span className="font-semibold">{chip.name}</span>
                {chip.count > 1 ? <span className="num font-bold">×{chip.count}</span> : null}
                <button
                  type="button"
                  aria-label={`Quitar una amarilla de ${chip.name}`}
                  className="rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => onRemoveCard("amarilla", chip.playerId)}
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </li>
            ))}
            {redChips.map((chip) => (
              <li
                key={`r-${chip.playerId}`}
                className="flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-1.5 py-1 text-[11px]"
              >
                <span aria-hidden="true" className="size-2.5 rounded-sm bg-rose-600" />
                <span className="font-semibold">{chip.name}</span>
                {chip.count > 1 ? <span className="num font-bold">×{chip.count}</span> : null}
                <button
                  type="button"
                  aria-label={`Quitar una roja de ${chip.name}`}
                  className="rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => onRemoveCard("roja", chip.playerId)}
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-muted-foreground">Sin tarjetas registradas.</p>
        )}
      </div>

      {/* Injuries */}
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          <Stethoscope className="size-3" aria-hidden="true" />
          Lesiones (jugador + duración)
        </span>
        <div className="grid grid-cols-[1fr_5rem_auto] gap-2">
          {playerSelect}
          <Input
            type="number"
            min={1}
            max={60}
            aria-label="Jornadas de baja"
            className="h-10"
            value={injuryDays}
            onChange={(event) =>
              setInjuryDays(Math.min(60, Math.max(1, Number(event.target.value) || 1)))
            }
          />
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={!canAct}
            onClick={() => {
              const player = side.players.find((row) => row.playerId === selection);
              if (player) onAddInjury(player.playerId, player.name);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
          </Button>
        </div>
        {injuryChips.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {injuryChips.map((chip) => (
              <li
                key={chip.playerId}
                className="flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/[0.08] px-1.5 py-1 text-[11px]"
              >
                <span className="font-semibold">{chip.name}</span>
                <span className="num text-muted-foreground">{chip.matchdays} jornada(s)</span>
                <button
                  type="button"
                  aria-label={`Quitar la lesión de ${chip.name}`}
                  className="rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => onRemoveInjury(chip.playerId)}
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-muted-foreground">Sin lesionados en este partido.</p>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        El jugador seleccionado ahora es «{selectedName || "—"}»: úsalo para goles, tarjetas o
        lesión.
      </p>
    </section>
  );
}
