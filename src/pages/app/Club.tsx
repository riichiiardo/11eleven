import { useState } from "react";
import type { AppStateView } from "@/convex/appTypes";
import { formatMoney } from "@/convex/rulesEngine";
import { useNavigate, useOutletContext } from "react-router";
import { Crest } from "@/components/eleven/Crest";
import { SectionCard, StatTile } from "@/components/eleven/SectionCard";
import { PitchView } from "@/components/eleven/PitchView";
import { GroupMeter, RuleCheckList } from "@/components/eleven/RuleCheckList";
import {
  AvailabilityBadge,
  OvrBadge,
  PlayerAvatar,
} from "@/components/eleven/PlayerBits";
import { PlayerDialog } from "@/components/eleven/PlayerDialog";
import { useSquadActions } from "@/hooks/use-squad-actions";
import type { SquadPlayerView } from "@/convex/rulesEngine";
import { Button } from "@/components/ui/button";
import {
  Activity,
  BadgeEuro,
  Baby,
  ClipboardList,
  Crown,
  Shirt,
  TrendingUp,
  Users,
} from "lucide-react";

export default function Club() {
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

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <section className="card-soft flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Crest
            name={club.name}
            shortName={club.shortName}
            colors={[club.colorPrimary, club.colorSecondary]}
            size="lg"
          />
          <div>
            <h1 className="display text-2xl leading-tight">{club.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {club.league} · {club.country} ·{" "}
              <span className="font-semibold text-foreground">
                {state.president?.nickname}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => navigate("/dashboard/club/plantilla")}
          >
            <Users className="size-4" aria-hidden="true" />
            Plantilla completa
          </Button>
          <Button
            type="button"
            className="min-h-11"
            onClick={() => navigate("/dashboard/formacion")}
          >
            <Shirt className="size-4" aria-hidden="true" />
            Ajustar once
          </Button>
        </div>
      </section>

      <section
        aria-label="Indicadores del club"
        className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
      >
        <StatTile
          icon={Users}
          value={`${stats.size} / ${rules.squadSize}`}
          label="Jugadores"
          hint="Máximo según reglas"
        />
        <StatTile
          icon={TrendingUp}
          tone="pitch"
          value={formatMoney(stats.totalValue)}
          label="Valor de plantilla"
        />
        <StatTile
          icon={BadgeEuro}
          tone="gold"
          value={formatMoney(state.budget.available)}
          label="Presupuesto libre"
        />
        <StatTile icon={Crown} value={`${stats.averageOvr}`} label="OVR medio" />
        <StatTile icon={Activity} tone="slate" value={`${stats.averageAge}`} label="Edad media" />
        <StatTile
          icon={Baby}
          tone="pitch"
          value={`${stats.under21} / ${rules.maxU21}`}
          label="Sub-21"
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <SectionCard
          title="Formación actual"
          icon={Shirt}
          accent="pitch"
          className="xl:col-span-2"
          action={{ label: "Editar táctica", to: "/dashboard/formacion" }}
        >
          <PitchView
            formation={state.lineup.formation}
            lineup={state.lineup}
            squad={state.squad}
            onSlotClick={() => navigate("/dashboard/formacion")}
            caption="Cada posición muestra el OVR del titular. La 'C' identifica al capitán: el jugador con mayor OVR del once."
          />
        </SectionCard>

        <div className="flex flex-col gap-5">
          <SectionCard title="Distribución por posición" icon={Users}>
            <div className="grid gap-4">
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
          </SectionCard>

          <SectionCard
            title="Situación en el mercado"
            icon={ClipboardList}
            action={{ label: "Gestionar", to: "/dashboard/club/estado" }}
          >
            <ul className="flex flex-col gap-2.5">
              {(
                ["transferible", "negociacion", "neutro", "intransferible"] as const
              ).map((option) => (
                <li key={option} className="flex items-center justify-between gap-3">
                  <AvailabilityBadge availability={option} />
                  <span className="num text-sm font-bold">{state.availability[option]}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <SectionCard
          title="Chequeo del reglamento"
          icon={ClipboardList}
          className="xl:col-span-2"
          action={{ label: "Ver reglas", to: "/dashboard/reglas" }}
        >
          <RuleCheckList checks={state.evaluation?.checks ?? []} variant="full" />
        </SectionCard>

        <SectionCard
          title="Jugadores clave"
          icon={Crown}
          action={{ label: "Plantilla", to: "/dashboard/club/plantilla" }}
        >
          <ul className="flex flex-col gap-3">
            {stats.topPlayers.map((player) => (
              <li key={player.squadPlayerId}>
                <button
                  type="button"
                  onClick={() => setSelected(player)}
                  className="flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors hover:bg-accent"
                >
                  <PlayerAvatar
                    name={player.name}
                    flag={player.flag}
                    group={player.group}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{player.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {player.position} · {formatMoney(player.value)}
                    </span>
                  </span>
                  <OvrBadge ovr={player.ovr} />
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <PlayerDialog
        player={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        saving={savingAvailability}
        onSaveAvailability={async (playerId, availability) => {
          if (!selected) return;
          await saveAvailability(playerId, availability, selected.name);
        }}
      />
    </div>
  );
}
