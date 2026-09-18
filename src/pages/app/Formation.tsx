import { useMemo, useState } from "react";
import type { AppStateView } from "@/convex/appTypes";
import { api } from "@/convex/_generated/api";
import {
  FORMATIONS,
  FORMATION_CODES,
  evaluateLineup,
  formatMoney,
  remapLineup,
  autoLineup,
  POSITION_LABEL,
  type FormationCode,
  type Lineup,
} from "@/convex/rulesEngine";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";
import { useLocation, useOutletContext } from "react-router";
import { SectionCard } from "@/components/eleven/SectionCard";
import { PitchView } from "@/components/eleven/PitchView";
import { RuleCheckList } from "@/components/eleven/RuleCheckList";
import { OvrBadge, PlayerAvatar, PositionPill } from "@/components/eleven/PlayerBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, RotateCcw, Search, Shirt, Sparkles, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Formation() {
  const state = useOutletContext<AppStateView>();
  const location = useLocation();
  const saveLineup = useMutation(api.squads.saveLineup);
  const autoFill = useMutation(api.squads.autoFillLineup);

  const serverLineup = state.lineup;
  // "Alinear en el XI" from the squad page arrives with the player pre-selected.
  const incomingPlayerId =
    (location.state as { playerId?: string } | null)?.playerId ?? null;
  const [draft, setDraft] = useState<Lineup | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
    incomingPlayerId,
  );
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const lineup = draft ?? serverLineup;
  const rules = state.rules;
  const squad = state.squad;

  const evaluation = useMemo(
    () =>
      rules && lineup
        ? evaluateLineup(rules, squad, lineup, state.evaluation ?? undefined)
        : null,
    [rules, squad, lineup, state.evaluation],
  );

  const assignedIds = new Set(
    (lineup?.slots ?? []).map((slot) => slot.playerId).filter(Boolean) as string[],
  );
  const selectedPlayer = squad.find((player) => player.playerId === selectedPlayerId) ?? null;
  const bench = squad
    .filter((player) => !assignedIds.has(player.playerId as string))
    .sort((a, b) => b.ovr - a.ovr);

  const filteredBench = bench.filter((player) => {
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return (
      player.name.toLowerCase().includes(term) ||
      player.position.toLowerCase().includes(term) ||
      player.nationality.toLowerCase().includes(term)
    );
  });

  if (!rules || !lineup || !evaluation || !state.club) return null;

  const definition = FORMATIONS[lineup.formation];
  const formationChanged = draft ? draft.formation !== serverLineup?.formation : false;
  const isDirty = Boolean(draft);

  const highlight = selectedPlayer
    ? {
        valid: new Set(
          definition.slots
            .filter((slot) => slot.accepts.includes(selectedPlayer.position))
            .map((slot) => slot.id),
        ),
        invalid: new Set(
          definition.slots
            .filter((slot) => !slot.accepts.includes(selectedPlayer.position))
            .map((slot) => slot.id),
        ),
      }
    : undefined;

  const assignToSlot = (slotId: string) => {
    if (!selectedPlayer) return;
    const slot = definition.slots.find((item) => item.id === slotId);
    if (!slot) return;
    if (!slot.accepts.includes(selectedPlayer.position)) {
      toast.error("Posición incompatible", {
        description: `${selectedPlayer.name} (${selectedPlayer.position}) no puede ocupar ${POSITION_LABEL[slot.label]} en esta formación.`,
      });
      return;
    }
    const nextSlots = definition.slots.map((item) => {
      const current = lineup.slots.find((entry) => entry.slotId === item.id)?.playerId ?? null;
      if (item.id === slotId) return { slotId: item.id, playerId: selectedPlayer.playerId };
      if (current === selectedPlayer.playerId) return { slotId: item.id, playerId: null };
      return { slotId: item.id, playerId: current };
    });
    setDraft({ formation: lineup.formation, slots: nextSlots });
    setSelectedPlayerId(null);
  };

  const handleSlotClick = (slotId: string) => {
    if (selectedPlayer) {
      assignToSlot(slotId);
      return;
    }
    const playerId = lineup.slots.find((slot) => slot.slotId === slotId)?.playerId ?? null;
    if (playerId) {
      setSelectedPlayerId(playerId);
    } else {
      toast.info("Elige primero un jugador", {
        description:
          "Selecciona un jugador del banquillo y después la posición donde quieres alinearlo.",
      });
    }
  };

  const removeFromLineup = (playerId: string) => {
    setDraft({
      formation: lineup.formation,
      slots: lineup.slots.map((slot) =>
        slot.playerId === playerId ? { slotId: slot.slotId, playerId: null } : slot,
      ),
    });
    setSelectedPlayerId(null);
  };

  const changeFormation = (code: FormationCode) => {
    setDraft(remapLineup(squad, code, lineup));
    setSelectedPlayerId(null);
  };

  const runAuto = () => {
    setDraft(autoLineup(squad, lineup.formation));
    setSelectedPlayerId(null);
    toast.info("Once propuesto por el motor", {
      description:
        "Se alinean los jugadores con mayor OVR en cada posición. Revísalo y guarda para confirmar.",
    });
  };

  const persist = async () => {
    setBusy(true);
    try {
      await saveLineup({
        formation: lineup.formation,
        slots: lineup.slots,
      });
      setDraft(null);
      toast.success("Alineación guardada", {
        description: `${definition.label} · ${evaluation.starters.length} titulares verificados por el motor de reglas.`,
      });
    } catch (cause) {
      toast.error("No se pudo guardar la alineación", {
        description: errorMessage(cause),
      });
    } finally {
      setBusy(false);
    }
  };

  const persistAuto = async () => {
    setBusy(true);
    try {
      await autoFill({ formation: lineup.formation });
      setDraft(null);
      toast.success("Alineación automática aplicada", {
        description: "El motor eligió el mejor once posible y lo validó contra las reglas.",
      });
    } catch (cause) {
      toast.error("No se pudo aplicar la alineación automática", {
        description: errorMessage(cause),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="display text-2xl">Formación y táctica</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Selecciona un jugador y después la posición donde quieres alinearlo. No hace falta
            arrastrar: el flujo es compatible con teclado y lectores de pantalla.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDirty ? (
            <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300">
              Cambios sin guardar
            </Badge>
          ) : (
            <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <Check className="size-3" aria-hidden="true" />
              Alineación sincronizada
            </Badge>
          )}
          {isDirty ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setDraft(null);
                setSelectedPlayerId(null);
              }}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Descartar
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={runAuto}
          >
            <Wand2 className="size-4" aria-hidden="true" />
            Proponer once
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            disabled={busy}
            onClick={persistAuto}
            title="Aplica y guarda directamente el once propuesto por el motor"
          >
            Guardar automático
          </Button>
        </div>
      </header>

      <SectionCard title="Esquema táctico" icon={Shirt} accent="pitch">
        <div
          role="radiogroup"
          aria-label="Formación"
          className="flex flex-wrap gap-2"
        >
          {FORMATION_CODES.map((code) => {
            const option = FORMATIONS[code];
            const active = code === lineup.formation;
            return (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => changeFormation(code)}
                className={cn(
                  "flex min-h-11 min-w-[128px] flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                    : "border-border hover:bg-accent",
                )}
              >
                <span className="display text-sm">{option.label}</span>
                <span className="text-[11px] text-muted-foreground">{option.shape}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {definition.description}
          {formationChanged
            ? " Al cambiar de esquema el motor recoloca a los jugadores compatibles y deja libres las posiciones que nadie puede cubrir."
            : ""}
        </p>
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="flex flex-col gap-5 xl:col-span-2">
          <SectionCard
            title="Pizarra"
            icon={Shirt}
            accent="pitch"
            action={{ label: "Ver plantilla", to: "/dashboard/club/plantilla" }}
          >
            {selectedPlayer ? (
              <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-brand/30 bg-brand/[0.06] p-3">
                <PlayerAvatar
                  name={selectedPlayer.name}
                  flag={selectedPlayer.flag}
                  group={selectedPlayer.group}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    Colocando a {selectedPlayer.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {POSITION_LABEL[selectedPlayer.position]} · OVR {selectedPlayer.ovr} ·
                    posiciones resaltadas compatibles
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-9"
                  onClick={() => setSelectedPlayerId(null)}
                >
                  <X className="size-3.5" aria-hidden="true" />
                  Cancelar
                </Button>
                {assignedIds.has(selectedPlayer.playerId as string) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-9"
                    onClick={() => removeFromLineup(selectedPlayer.playerId as string)}
                  >
                    Quitar del once
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="mb-3 rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                Selecciona una posición ocupada para editar a ese jugador, o elige un jugador en
                el panel derecho para colocarlo en el campo.
              </p>
            )}

            <PitchView
              formation={lineup.formation}
              lineup={lineup}
              squad={squad}
              mode="edit"
              highlight={highlight}
              onSlotClick={handleSlotClick}
            />
          </SectionCard>
        </div>

        <div className="flex flex-col gap-5">
          <SectionCard title="Validación en vivo" icon={Sparkles}>
            <div className="mb-3 rounded-lg border p-3">
              <p className="display text-sm">
                {evaluation.valid ? "Alineación válida" : "Alineación incompleta"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {evaluation.valid
                  ? "Puedes guardar: el once cumple posición, cupos y reglas del torneo."
                  : evaluation.errors[0] ??
                    evaluation.checks.find((check) => !check.passed)?.detail ??
                    "Completa el once para poder guardar."}
              </p>
            </div>
            <RuleCheckList checks={evaluation.checks} />
            <Button
              type="button"
              className="mt-3 min-h-11 w-full"
              disabled={!evaluation.valid || !isDirty || busy}
              onClick={persist}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Guardando…
                </>
              ) : evaluation.valid ? (
                isDirty ? (
                  "Guardar formación"
                ) : (
                  "Sin cambios por guardar"
                )
              ) : (
                "Corrige los errores para guardar"
              )}
            </Button>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              El mismo motor valida en el servidor: si algo cambia mientras editas, la operación
              se rechaza con la explicación exacta.
            </p>
          </SectionCard>

          <SectionCard
            title={`Banquillo (${bench.length})`}
            icon={Shirt}
            bodyClassName="p-0"
          >
            <div className="border-b p-3">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar en el banquillo…"
                  aria-label="Buscar jugador en el banquillo"
                  className="h-11 pl-9"
                />
              </div>
            </div>
            <ul className="scroll-thin max-h-[420px] divide-y overflow-y-auto">
              {filteredBench.map((player) => (
                <li key={player.squadPlayerId}>
                  <button
                    type="button"
                    onClick={() => setSelectedPlayerId(player.playerId as string)}
                    aria-pressed={selectedPlayerId === player.playerId}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent",
                      selectedPlayerId === player.playerId && "bg-primary/5",
                    )}
                  >
                    <PlayerAvatar
                      name={player.name}
                      flag={player.flag}
                      group={player.group}
                      size="xs"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{player.name}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <PositionPill position={player.position} group={player.group} />
                        {formatMoney(player.value)}
                      </span>
                    </span>
                    <OvrBadge ovr={player.ovr} />
                  </button>
                </li>
              ))}
              {filteredBench.length === 0 ? (
                <li className="p-4 text-sm text-muted-foreground">
                  No quedan jugadores disponibles con ese filtro.
                </li>
              ) : null}
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
