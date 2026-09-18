import { cn } from "@/lib/utils";
import {
  formatMoney,
  POSITION_LABEL,
  type SquadPlayerView,
  type SquadStats,
} from "@/convex/rulesEngine";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { GroupMeter } from "./RuleCheckList";
import { AvailabilityBadge, OvrBadge, PlayerAvatar, PositionPill } from "./PlayerBits";
import { ChevronRight } from "lucide-react";

export function SquadTable({
  squad,
  stats,
  onSelect,
  selectLabel = "Ver ficha",
  className,
}: {
  squad: SquadPlayerView[];
  stats: SquadStats;
  onSelect?: (player: SquadPlayerView) => void;
  selectLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border", className)}>
      <div className="overflow-x-auto scroll-thin">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead>Jugador</TableHead>
              <TableHead className="w-16 text-center">POS</TableHead>
              <TableHead className="w-16 text-center">OVR</TableHead>
              <TableHead className="hidden w-16 text-center sm:table-cell">Edad</TableHead>
              <TableHead className="hidden w-24 text-right md:table-cell">Valor</TableHead>
              <TableHead className="min-w-[150px]">Estado</TableHead>
              <TableHead className="w-24 text-right">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {squad.map((player, index) => (
              <TableRow key={player.squadPlayerId}>
                <TableCell className="num text-center text-xs text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <PlayerAvatar
                      name={player.name}
                      flag={player.flag}
                      group={player.group}
                      size="xs"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{player.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {player.nationality} · {POSITION_LABEL[player.position]}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <PositionPill position={player.position} group={player.group} />
                </TableCell>
                <TableCell className="text-center">
                  <OvrBadge ovr={player.ovr} />
                </TableCell>
                <TableCell className="num hidden text-center sm:table-cell">
                  {player.age}
                </TableCell>
                <TableCell className="num hidden text-right md:table-cell">
                  {formatMoney(player.value)}
                </TableCell>
                <TableCell>
                  <AvailabilityBadge availability={player.availability} />
                </TableCell>
                <TableCell className="text-right">
                  {onSelect ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-9"
                      onClick={() => onSelect(player)}
                    >
                      {selectLabel}
                      <ChevronRight className="size-3.5" aria-hidden="true" />
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={3} className="text-xs font-semibold uppercase tracking-wide">
                Valor total
              </TableCell>
              <TableCell colSpan={2} className="num text-left font-semibold">
                {formatMoney(stats.totalValue)}
              </TableCell>
              <TableCell className="num hidden text-right font-semibold md:table-cell">
                {stats.size} jugadores
              </TableCell>
              <TableCell className="num text-xs text-muted-foreground">
                Edad media {stats.averageAge} · OVR medio {stats.averageOvr}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}

export function SquadShapeRow({
  stats,
  limits,
  className,
}: {
  stats: SquadStats;
  limits: Record<"GK" | "DEF" | "MID" | "FWD", { min: number; max: number }>;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
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
  );
}
