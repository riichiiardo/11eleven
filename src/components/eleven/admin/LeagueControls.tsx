import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { AdminOverviewView, TournamentView } from "@/convex/appTypes";
import { errorMessage } from "@/lib/errors";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { SectionCard } from "@/components/eleven/SectionCard";
import { CompetitionPicker } from "@/components/eleven/CompetitionPicker";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fc27Competition } from "@/convex/fc27Catalog";
import { FieldLabel } from "@/components/eleven/admin/AdminBits";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Gamepad2,
  Loader2,
  RotateCcw,
  Save,
} from "lucide-react";

/**
 * The league always mirrors ONE EA SPORTS FC 27 competition: the catalogue is
 * the single source of truth for creating and configuring tournaments so both
 * games stay in parity.
 */
export function CompetitionCard({ tournament }: { tournament: TournamentView }) {
  const setCompetition = useMutation(api.adminOps.setCompetition);
  const [draft, setDraft] = useState(tournament.competitionId ?? "");
  const [busy, setBusy] = useState(false);
  const selected = fc27Competition(tournament.competitionId);

  const dirty = draft !== "" && draft !== tournament.competitionId;

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const result = await setCompetition({ competitionId: draft });
      toast.success("Competición configurada", {
        description: `«${result.name}» · ${result.matchdays} jornadas. La liga replica esa competición de EA SPORTS FC 27.`,
      });
    } catch (cause) {
      toast.error("No se pudo cambiar la competición", {
        description: errorMessage(cause),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="Competición (paridad con EA SPORTS FC 27)"
      icon={Gamepad2}
      accent="gold"
      bodyClassName="flex flex-col gap-3"
    >
      <p className="max-w-3xl text-sm text-muted-foreground">
        El catálogo de competiciones de <strong>EA SPORTS FC 27</strong> es la única referencia
        para crear y configurar torneos en 11Eleven: si una competición no existe en FC 27, no
        puede existir aquí. Al elegirla se ajustan las jornadas al formato real.
      </p>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <CompetitionPicker
          id="adminCompetition"
          value={draft || tournament.competitionId || ""}
          onChange={setDraft}
          hint="Solo competiciones oficiales de FC 27: ligas, copas e internacionales."
          disabled={busy}
        />
        <Button
          type="button"
          className="min-h-11"
          disabled={busy || !dirty}
          onClick={() => void save()}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          Aplicar competición
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">{tournament.totalMatchdays} jornadas</Badge>
        <Badge variant="outline">{tournament.season}</Badge>
        {selected ? (
          <span className="text-muted-foreground">
            Configurada: <strong className="text-foreground">{selected.name}</strong> ·{" "}
            {selected.country}
          </span>
        ) : (
          <span className="text-amber-700 dark:text-amber-300">
            Sin competición asignada todavía (las ligas nuevas ya nacen con una).
          </span>
        )}
      </div>
    </SectionCard>
  );
}

/**
 * Danger zone: leave the league exactly as it was created — teams, budgets
 * and squads back to zero. Rules, prizes, members and the audit trail survive.
 */
export function ResetLeagueCard({ overview }: { overview: AdminOverviewView }) {
  const resetLeague = useMutation(api.adminOps.resetLeague);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const totals = overview.totals;

  const submit = async () => {
    setBusy(true);
    try {
      const result = await resetLeague({ confirmation: confirm });
      toast.success("Liga reiniciada desde cero", {
        description: `${result.counts.presidents} presidencias, ${result.counts.squads} plantillas y ${result.counts.fixtures} partidos borrados. Vuelve a la fase de selección de clubes.`,
      });
      setOpen(false);
      setConfirm("");
    } catch (cause) {
      toast.error("No se pudo reiniciar la liga", {
        description: errorMessage(cause),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="card-soft flex flex-col gap-3 border-rose-500/30 p-4">
        <header className="flex items-center gap-2">
          <span aria-hidden="true" className="h-4 w-1 rounded-full bg-rose-500" />
          <h3 className="display flex items-center gap-2 text-[13px] text-rose-700 dark:text-rose-300">
            <RotateCcw className="size-4" aria-hidden="true" />
            Reiniciar la liga desde cero
          </h3>
        </header>
        <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Borra los equipos seleccionados, los presupuestos asignados, las plantillas, las
          operaciones, el draft y el calendario para dejar la liga como el primer día. Se conservan
          las reglas, los premios configurados, los miembros, los administradores y la auditoría.
        </p>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <Badge variant="outline">{totals.squads} plantillas</Badge>
          <Badge variant="outline">{totals.players} jugadores</Badge>
          <Badge variant="outline">{overview.presidents.length} presidencias</Badge>
          <Badge variant="outline">{overview.clubs.length} clubes</Badge>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 self-start border-rose-500/40 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
          onClick={() => setOpen(true)}
        >
          <AlertTriangle className="size-4" aria-hidden="true" />
          Reiniciar liga
        </Button>
      </section>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="display text-rose-700 dark:text-rose-300">
              ¿Reiniciar «{overview.tournament?.name}» desde cero?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>{overview.presidents.length} presidencias y sus presupuestos.</li>
            <li>
              {totals.squads} plantillas con {totals.players} jugadores (vuelven a agente libre).
            </li>
            <li>Clubes seleccionados, operaciones de mercado, draft y calendario completo.</li>
            <li>Resultados detallados registrados en los partidos.</li>
          </ul>

          <div className="flex flex-col gap-1.5">
            <FieldLabel
              htmlFor="resetConfirm"
              tip='Escribe REINICIAR en mayúsculas para confirmar. Es la salvaguarda definitiva contra un clic accidental: la liga vuelve a la fase de selección de clubes.'
            >
              Confirmación
            </FieldLabel>
            <Input
              id="resetConfirm"
              className="h-11"
              placeholder="REINICIAR"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Reglas y premios se mantienen tal como los configuraste.
            </p>
          </div>

          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="min-h-11 bg-rose-600 text-white hover:bg-rose-700"
              disabled={busy || confirm.trim().toUpperCase() !== "REINICIAR"}
              onClick={() => void submit()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="size-4" aria-hidden="true" />
              )}
              Reiniciar la liga
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
