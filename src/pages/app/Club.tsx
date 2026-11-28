import { rpc } from "@/infrastructure/supabase/client";
import { errorMessage } from "@/lib/errors";
import type { CompetitionFormation } from "./Formation";
import { SoldPlayerDialog } from "@/components/eleven/SoldPlayerDialog";
import { AvailabilityWithdrawalDialog } from "@/components/eleven/AvailabilityWithdrawalDialog";
import { useEffect, useState } from "react";
import { DraftPrelist } from "@/components/eleven/DraftPrelist";
import type { AppStateView } from "@/domain/appTypes";
import { FORMATIONS, formatMoney } from "@/domain/rulesEngine";
import { Link, useNavigate } from "react-router";
import { useDashboardState } from "./dashboard-context";
import { DashboardUnavailable } from "./DashboardUnavailable";
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
import type { SquadPlayerView } from "@/domain/rulesEngine";
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

export default function Club({ state: directState }: { state?: AppStateView }) {
  const contextState = useDashboardState();
  const state = directState ?? contextState;
  const navigate = useNavigate();
  const { saveAvailability, savingAvailability, pendingAvailability, confirmAvailability, cancelAvailability, pendingSale, cancelSale } = useSquadActions();
  const [selected, setSelected] = useState<SquadPlayerView | null>(null);

  if (!state) return <DashboardUnavailable title="Mi club" />;

  const club = state.club;
  const rules = state.rules;
  const stats = state.stats;
  if (!club || !rules || !stats)
    return <DashboardUnavailable title="Mi club" />;

  const limits = {
    GK: { min: rules.gkMin, max: rules.gkMax },
    DEF: { min: rules.defMin, max: rules.defMax },
    MID: { min: rules.midMin, max: rules.midMax },
    FWD: { min: rules.fwdMin, max: rules.fwdMax },
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      {pendingSale ? <SoldPlayerDialog key={pendingSale.squadPlayerId} selection={pendingSale} onClose={cancelSale} /> : null}
      <AvailabilityWithdrawalDialog change={pendingAvailability} busy={savingAvailability} onCancel={cancelAvailability} onConfirm={confirmAvailability} />
      <section className="card-soft flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Crest
            name={club.name}
            shortName={club.shortName}
            colors={[club.colorPrimary, club.colorSecondary]}
            crestUrl={club.crestUrl}
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
        <StatTile
          icon={Crown}
          value={`${stats.averageOvr}`}
          label="OVR medio"
        />
        <StatTile
          icon={Activity}
          tone="slate"
          value={`${stats.averageAge}`}
          label="Edad media"
        />
        <StatTile
          icon={Baby}
          tone="pitch"
          value={`${stats.under21} / ${rules.maxU21}`}
          label="Sub-21"
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <ClubFormation key={club.id} squad={state.squad} />

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
                [
                  "transferible",
                  "negociacion",
                  "neutro",
                  "intransferible",
                  "vendido",
                ] as const
              ).map((option) => (
                <li
                  key={option}
                  className="flex items-center justify-between gap-3"
                >
                  <AvailabilityBadge availability={option} />
                  <span className="num text-sm font-bold">
                    {state.availability[option] ?? 0}
                  </span>
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
          <RuleCheckList
            checks={state.evaluation?.checks ?? []}
            variant="full"
          />
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
                    photo={player.photo}
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
          </ul>
        </SectionCard>
      </div>

      <DraftPrelist key={`${state.tournament?.id}:${state.president?.id}`} />

      <PlayerDialog
        player={state.squad.find((player) => player.squadPlayerId === selected?.squadPlayerId) ?? selected}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        saving={savingAvailability}
        onSaveAvailability={async (squadPlayerId, availability) => {
          if (!selected) return false;
          return saveAvailability(squadPlayerId, availability, selected.name);
        }}
      />
    </div>
  );
}

function ClubFormation({ squad }: { squad: AppStateView["squad"] }) {
  const navigate = useNavigate();
  const [options, setOptions] = useState<CompetitionFormation[]>();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    rpc<CompetitionFormation[]>("formation_competitions").then(
      (rows) => {
        if (active) setOptions(rows);
      },
      (cause) => {
        if (active) setError(errorMessage(cause));
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  const competition =
    options?.find((item) => item.id === selected) ??
    options?.find((item) => /\bchampions\b/i.test(item.name)) ??
    options?.[0];
  const lineup = competition?.lineup;
  const editUrl = competition
    ? `/dashboard/formacion?competicion=${encodeURIComponent(competition.id)}`
    : "/dashboard/formacion";

  return (
    <SectionCard
      title="Formación"
      icon={Shirt}
      accent="pitch"
      className="xl:col-span-2"
    >
      {error ? (
        <div className="space-y-2">
          <p role="alert">{error}</p>
          <Button
            variant="outline"
            onClick={() => {
              setError("");
              setAttempt((n) => n + 1);
            }}
          >
            Reintentar
          </Button>
        </div>
      ) : !options ? (
        <p role="status">Cargando competiciones…</p>
      ) : !competition ? (
        <p>Tu club aún no tiene competiciones habilitadas.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1">
              Competición
              <select
                className="rounded-md border bg-background p-2"
                value={competition.id}
                onChange={(event) => setSelected(event.target.value)}
              >
                {options.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <Button asChild variant="outline">
              <Link to={editUrl}>Editar táctica</Link>
            </Button>
          </div>
          {lineup &&
          Object.prototype.hasOwnProperty.call(FORMATIONS, lineup.formation) ? (
            <PitchView
              formation={lineup.formation}
              lineup={lineup}
              squad={squad}
              onSlotClick={() => navigate(editUrl)}
              caption="Cada posición muestra el OVR del titular. La C identifica al capitán."
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Aún no hay una formación guardada para {competition.name}.
            </p>
          )}
        </div>
      )}
    </SectionCard>
  );
}
