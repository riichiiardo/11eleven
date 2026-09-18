import type { AppStateView } from "@/convex/appTypes";
import {
  AVAILABILITIES,
  AVAILABILITY_META,
  formatMoney,
  type PlayerAvailability,
} from "@/convex/rulesEngine";
import { useNavigate, useOutletContext } from "react-router";
import { SectionCard } from "@/components/eleven/SectionCard";
import { AvailabilityBadge, PlayerAvatar, PositionPill } from "@/components/eleven/PlayerBits";
import { useSquadActions } from "@/hooks/use-squad-actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Info, Shirt, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PlayerStatus() {
  const state = useOutletContext<AppStateView>();
  const navigate = useNavigate();
  const { saveAvailability, savingAvailability } = useSquadActions();

  const stats = state.stats;
  if (!stats) return null;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="display text-2xl">Estado de jugadores</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            La situación que marques en cada jugador es exactamente lo que verán los demás
            Presidentes cuando abran la plantilla de {state.club?.name}. Cada estado incluye
            icono, texto y color: nunca se comunica solo con color.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => navigate("/dashboard/club/plantilla")}
          >
            <Users className="size-4" aria-hidden="true" />
            Ver plantilla
          </Button>
          <Button
            type="button"
            className="min-h-11"
            onClick={() => navigate("/dashboard/formacion")}
          >
            <Shirt className="size-4" aria-hidden="true" />
            Formación
          </Button>
        </div>
      </header>

      <section aria-label="Leyenda de situaciones" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {AVAILABILITIES.map((option) => {
          const meta = AVAILABILITY_META[option];
          return (
            <div key={option} className="card-soft flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <AvailabilityBadge availability={option} />
                <span className="num display text-lg">{state.availability[option]}</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {meta.description}
              </p>
            </div>
          );
        })}
      </section>

      <SectionCard
        title="Gestiona la situación de tu plantilla"
        icon={Users}
        bodyClassName="p-0"
      >
        <ul className="divide-y">
          {state.squad.map((player) => (
            <li
              key={player.squadPlayerId}
              className={cn(
                "flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4",
                savingAvailability && "opacity-80",
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <PlayerAvatar
                  name={player.name}
                  flag={player.flag}
                  group={player.group}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{player.name}</p>
                  <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                    <PositionPill position={player.position} group={player.group} />
                    {player.nationality} · {player.age} años · {formatMoney(player.value)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 sm:justify-end">
                <AvailabilityBadge
                  availability={player.availability}
                  showLabel={false}
                  className="sm:hidden"
                />
                <Select
                  value={player.availability}
                  disabled={savingAvailability}
                  onValueChange={(next) =>
                    saveAvailability(
                      player.playerId,
                      next as PlayerAvailability,
                      player.name,
                    )
                  }
                >
                  <SelectTrigger
                    className="min-h-11 w-full sm:w-[230px]"
                    aria-label={`Situación de ${player.name}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABILITIES.map((option) => (
                      <SelectItem key={option} value={option} className="min-h-11">
                        <span aria-hidden="true" className="mr-2">
                          {AVAILABILITY_META[option].symbol}
                        </span>
                        {AVAILABILITY_META[option].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      <p className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        Solo puedes gestionar jugadores de tu propia plantilla ({stats.size} jugadores). El motor
        de reglas impide cualquier operación que rompa el reglamento del torneo y registra cada
        cambio en la auditoría.
      </p>
    </div>
  );
}
