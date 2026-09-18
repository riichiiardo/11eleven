import { useState } from "react";
import type { AppStateView } from "@/convex/appTypes";
import { FC_VERSION, formatMoney, type SquadPlayerView } from "@/convex/rulesEngine";
import { useNavigate, useOutletContext } from "react-router";
import { SectionCard } from "@/components/eleven/SectionCard";
import { PitchView } from "@/components/eleven/PitchView";
import { SquadTable } from "@/components/eleven/SquadTable";
import { GroupMeter } from "@/components/eleven/RuleCheckList";
import {
  AvailabilityBadge,
  OvrBadge,
  PlayerAvatar,
  PositionPill,
} from "@/components/eleven/PlayerBits";
import { PlayerDialog } from "@/components/eleven/PlayerDialog";
import { useSquadActions } from "@/hooks/use-squad-actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ClipboardList, Info, LayoutGrid, Shirt, Sparkles } from "lucide-react";

export default function Squad() {
  const state = useOutletContext<AppStateView>();
  const navigate = useNavigate();
  const { saveAvailability, savingAvailability } = useSquadActions();
  const [selected, setSelected] = useState<SquadPlayerView | null>(null);

  const club = state.club;
  const rules = state.rules;
  const stats = state.stats;
  if (!club || !rules || !stats || !state.lineup) return null;

  const limits = {
    GK: { min: rules.gkMin, max: rules.gkMax },
    DEF: { min: rules.defMin, max: rules.defMax },
    MID: { min: rules.midMin, max: rules.midMax },
    FWD: { min: rules.fwdMin, max: rules.fwdMax },
  };

  const starters = state.lineupEvaluation?.starters ?? [];
  const bench = state.lineupEvaluation?.bench ?? [];
  const startersValue = starters.reduce((sum, player) => sum + player.value, 0);

  const goToFormation = (player: SquadPlayerView) =>
    navigate("/dashboard/formacion", { state: { playerId: player.playerId } });

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="display text-2xl">Plantilla</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.size} jugadores · {formatMoney(stats.totalValue)} · OVR medio{" "}
            {stats.averageOvr} · edad media {stats.averageAge}
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Datos de origen: {FC_VERSION}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => navigate("/dashboard/formacion")}
          >
            <Shirt className="size-4" aria-hidden="true" />
            Formación y táctica
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => navigate("/dashboard/club/estado")}
          >
            <ClipboardList className="size-4" aria-hidden="true" />
            Estado de jugadores
          </Button>
        </div>
      </header>

      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["GK", "DEF", "MID", "FWD"] as const).map((group) => (
          <GroupMeter
            key={group}
            group={group}
            count={stats.groupCounts[group]}
            min={limits[group].min}
            max={limits[group].max}
          />
        ))}
      </div>

      <Tabs defaultValue="campo" className="flex flex-col gap-4">
        <TabsList className="self-start">
          <TabsTrigger value="campo" className="min-h-10">
            <LayoutGrid className="size-4" aria-hidden="true" />
            Vista campo
          </TabsTrigger>
          <TabsTrigger value="lista" className="min-h-10">
            <ClipboardList className="size-4" aria-hidden="true" />
            Lista completa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campo" className="flex flex-col gap-5">
          <div className="grid gap-5 xl:grid-cols-3">
            <SectionCard title="Once titular" icon={Shirt} accent="pitch" className="xl:col-span-2">
              <PitchView
                formation={state.lineup.formation}
                lineup={state.lineup}
                squad={state.squad}
                onSlotClick={() => navigate("/dashboard/formacion")}
              />
              <dl className="mt-4 grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Valor del XI
                  </dt>
                  <dd className="num font-bold">{formatMoney(startersValue)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Titulares
                  </dt>
                  <dd className="num font-bold">{starters.length} / 11</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Banquillo
                  </dt>
                  <dd className="num font-bold">{bench.length}</dd>
                </div>
              </dl>
            </SectionCard>

            <SectionCard title="Banquillo" icon={ClipboardList}>
              <ul className="flex flex-col gap-2">
                {bench.map((player) => (
                  <li key={player.squadPlayerId}>
                    <button
                      type="button"
                      onClick={() => setSelected(player)}
                      className="flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors hover:bg-accent"
                    >
                      <PlayerAvatar
                        name={player.name}
                        flag={player.flag}
                        group={player.group}
                        size="xs"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {player.name}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {player.position} · {formatMoney(player.value)}
                        </span>
                      </span>
                      <OvrBadge ovr={player.ovr} />
                    </button>
                  </li>
                ))}
                {bench.length === 0 ? (
                  <li className="text-sm text-muted-foreground">
                    Todos tus jugadores están en el once.
                  </li>
                ) : null}
              </ul>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="lista" className="flex flex-col gap-5">
          <SquadTable squad={state.squad} stats={stats} onSelect={setSelected} />
          <p className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            La tabla muestra la situación de cada jugador en el mercado. Para cambiar el once
            titular usa la vista de formación: el motor de reglas valida cada posición antes de
            guardar.
          </p>
        </TabsContent>
      </Tabs>

      <SectionCard title="Todos los jugadores por situación" icon={ClipboardList}>
        <ul className="flex flex-wrap gap-2">
          {state.squad.map((player) => (
            <li key={player.squadPlayerId}>
              <button
                type="button"
                onClick={() => setSelected(player)}
                className="flex min-h-11 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:bg-accent"
              >
                <PlayerAvatar
                  name={player.name}
                  flag={player.flag}
                  group={player.group}
                  size="xs"
                />
                <span className="text-sm font-semibold">{player.name.split(" ").slice(-1)}</span>
                <PositionPill position={player.position} group={player.group} />
                <AvailabilityBadge availability={player.availability} showLabel={false} />
              </button>
            </li>
          ))}
        </ul>
      </SectionCard>

      <PlayerDialog
        player={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        saving={savingAvailability}
        assignLabel="Alinear en el XI"
        onAssign={goToFormation}
        onSaveAvailability={async (playerId, availability) => {
          if (!selected) return;
          await saveAvailability(playerId, availability, selected.name);
        }}
      />
    </div>
  );
}
