import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { AdminOverviewView } from "@/convex/appTypes";
import { formatMoney } from "@/convex/rulesEngine";
import { errorMessage } from "@/lib/errors";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { SectionCard } from "@/components/eleven/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tip } from "@/components/eleven/admin/AdminBits";
import { Loader2, Plus, Trophy, X } from "lucide-react";

type PrizePhase = "todos_contra_todos" | "cuadrangulares" | "fase_siguiente";

type PrizeRow = {
  phase: PrizePhase;
  position: number;
  label: string;
  amount: number;
};

const PHASES: Array<{ value: PrizePhase; label: string; hint: string }> = [
  {
    value: "todos_contra_todos",
    label: "Todos contra todos (la liga)",
    hint: "Posición final de la tabla al terminar la fase regular.",
  },
  {
    value: "cuadrangulares",
    label: "Cuadrangulares / liguillas",
    hint: "Premios de la ronda de grupos o cuadrangulares que sigue al todos contra todos.",
  },
  {
    value: "fase_siguiente",
    label: "Fase siguiente (semifinales, final…)",
    hint: "Premios de las fases finales posteriores a los cuadrangulares.",
  },
];

const PHASE_LABEL = Object.fromEntries(PHASES.map((phase) => [phase.value, phase.label]));

/**
 * Prizes assigned BEFORE the league starts: money per final position, split
 * between the round-robin, the groups/knockout rounds and the next phase.
 */
export function PrizesPanel({ overview }: { overview: AdminOverviewView }) {
  const setPrizes = useMutation(api.adminOps.setPrizes);
  const [rows, setRows] = useState<PrizeRow[]>(() =>
    overview.prizes.map((prize) => ({
      phase: prize.phase,
      position: prize.position,
      label: prize.label,
      amount: prize.amount,
    })),
  );
  const [busy, setBusy] = useState(false);

  // Re-sync the editor when the server table changes (adjusting state when a
  // prop changes, without an extra render from an effect).
  const serverKey = JSON.stringify(overview.prizes);
  const [draftKey, setDraftKey] = useState(serverKey);
  if (draftKey !== serverKey) {
    setDraftKey(serverKey);
    setRows(
      overview.prizes.map((prize) => ({
        phase: prize.phase,
        position: prize.position,
        label: prize.label,
        amount: prize.amount,
      })),
    );
  }

  const errors: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.phase}:${row.position}`;
    if (seen.has(key)) {
      errors.push(`Premio duplicado: ${PHASE_LABEL[row.phase]} · posición ${row.position}.`);
    }
    seen.add(key);
    if (row.label.trim().length < 2) {
      errors.push("Cada premio necesita un nombre (ej. «Campeón», «Mejor diferencia»).");
    }
    if (row.amount < 0) errors.push("Los importes no pueden ser negativos.");
  }

  const total = rows.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0);
  const dirty = JSON.stringify(rows) !== JSON.stringify(
    overview.prizes.map((prize) => ({
      phase: prize.phase,
      position: prize.position,
      label: prize.label,
      amount: prize.amount,
    })),
  );

  const update = (index: number, patch: Partial<PrizeRow>) => {
    setRows((previous) =>
      previous.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  };

  const addRow = (phase: PrizePhase) => {
    const nextPosition =
      rows.filter((row) => row.phase === phase).reduce((max, row) => Math.max(max, row.position), 0) + 1;
    setRows((previous) => [
      ...previous,
      { phase, position: nextPosition, label: "", amount: 500_000 },
    ]);
  };

  const submit = async () => {
    if (errors.length > 0) return;
    setBusy(true);
    try {
      const result = await setPrizes({ prizes: rows });
      toast.success("Premios guardados", {
        description: `${result.configured} premio(s) · bolsa total ${formatMoney(result.total)}. Ya se muestran en tu liga.`,
      });
    } catch (cause) {
      toast.error("No se pudieron guardar los premios", {
        description: errorMessage(cause),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard title="Premios por posición" icon={Trophy} accent="gold" bodyClassName="flex flex-col gap-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Define <strong>antes del inicio</strong> lo que gana cada Presidente según la posición en
        la que termine: la fase de todos contra todos, y si la liga continúa con cuadrangulares o
        ligullas, también los premios de esa ronda y de la fase siguiente. El motor los aplica al
        clasificar, y todo queda registrado en la auditoría.
      </p>

      <div className="grid gap-3">
        {PHASES.map((phase) => {
          const phaseRows = rows
            .map((row, index) => ({ row, index }))
            .filter((entry) => entry.row.phase === phase.value)
            .sort((a, b) => a.row.position - b.row.position);

          return (
            <fieldset key={phase.value} className="rounded-xl border p-3">
              <legend className="mb-1 flex items-center gap-1 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {phase.label}
                <Tip text={phase.hint} side="right" />
              </legend>

              {phaseRows.length === 0 ? (
                <p className="px-1 text-[11px] text-muted-foreground">
                  Sin premios configurados para esta fase todavía.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {phaseRows.map(({ row, index }) => (
                    <li
                      key={`${row.phase}-${row.position}-${index}`}
                      className="grid gap-2 sm:grid-cols-[6rem_1fr_10rem_auto] sm:items-end"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          Posición
                        </span>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          className="h-10"
                          value={row.position}
                          onChange={(event) =>
                            update(index, { position: Math.max(1, Number(event.target.value) || 1) })
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          Nombre del premio
                        </span>
                        <Input
                          className="h-10"
                          maxLength={60}
                          placeholder="Ej. Campeón, Subcampeón, Mejor diferencia de goles…"
                          value={row.label}
                          onChange={(event) => update(index, { label: event.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          Importe (€)
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step={100_000}
                          className="h-10"
                          value={row.amount}
                          onChange={(event) =>
                            update(index, { amount: Math.max(0, Number(event.target.value) || 0) })
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-10 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
                        onClick={() =>
                          setRows((previous) => previous.filter((_, rowIndex) => rowIndex !== index))
                        }
                      >
                        <X className="size-4" aria-hidden="true" />
                        Quitar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 min-h-9"
                onClick={() => addRow(phase.value)}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Añadir premio a esta fase
              </Button>
            </fieldset>
          );
        })}
      </div>

      {errors.length > 0 ? (
        <ul className="list-disc space-y-1 rounded-xl border border-rose-500/35 bg-rose-500/[0.06] pl-5 text-xs text-rose-700 dark:text-rose-300">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="min-h-11"
          disabled={busy || errors.length > 0 || !dirty}
          onClick={() => void submit()}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Trophy className="size-4" aria-hidden="true" />
          )}
          Guardar premios
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!dirty || busy}
          onClick={() =>
            setRows(
              overview.prizes.map((prize) => ({
                phase: prize.phase,
                position: prize.position,
                label: prize.label,
                amount: prize.amount,
              })),
            )
          }
        >
          Descartar cambios
        </Button>
        <p className="text-xs text-muted-foreground">
          {rows.length} premio(s) · bolsa total {formatMoney(total)}
        </p>
      </div>

      <div className="rounded-xl border bg-muted/40 p-3">
        <p className="flex items-center gap-1 text-xs font-semibold">
          Cómo configurarlo
          <Tip
            side="right"
            text="1) Añade los premios de la fase regular (posición 1, 2, 3…). 2) Si tu formato incluye cuadrangulares o liguillas, añade también esos premios. 3) Repite para la fase siguiente (semifinales y final). 4) Guarda: los premios quedan visibles para todos los Presidentes y no pueden editarse una vez iniciada la competición sin que Administración lo haga."
          />
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Cada fila es posición + nombre + importe. Usa el mismo criterio de nombres en todas las
          fases para que los Presidentes entiendan de un vistazo qué se llevan al finalizar.
        </p>
      </div>
    </SectionCard>
  );
}
