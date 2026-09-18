import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { AppStateView, ClubView, TeamSquadView } from "@/convex/appTypes";
import { formatMoney, POSITION_LABEL } from "@/convex/rulesEngine";
import { useQuery } from "convex/react";
import { useOutletContext } from "react-router";
import { SectionCard, StatTile } from "@/components/eleven/SectionCard";
import { Crest } from "@/components/eleven/Crest";
import { SquadShapeRow, SquadTable } from "@/components/eleven/SquadTable";
import { OvrBadge } from "@/components/eleven/PlayerBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowRightLeft,
  BadgeEuro,
  Eye,
  Loader2,
  ScanSearch,
  Shield,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CompareRow = {
  key: string;
  label: string;
  render: (team: TeamSquadView | null) => string;
  /** Which value is better: higher or lower. */
  better: "high" | "low" | null;
};

const COMPARE_ROWS: CompareRow[] = [
  { key: "squadSize", label: "Jugadores", render: (t) => String(t?.stats.size ?? 0), better: null },
  { key: "avgOvr", label: "OVR medio", render: (t) => String(t?.stats.averageOvr ?? 0), better: "high" },
  { key: "xiOvr", label: "OVR del XI", render: (t) => String(t?.xiOvr ?? 0), better: "high" },
  { key: "value", label: "Valor total", render: (t) => formatMoney(t?.stats.totalValue ?? 0), better: "high" },
  { key: "avgAge", label: "Edad media", render: (t) => String(t?.stats.averageAge ?? 0), better: "low" },
  { key: "u21", label: "Sub-21", render: (t) => String(t?.stats.under21 ?? 0), better: null },
];

function XiChips({ team }: { team: TeamSquadView }) {
  if (team.xi.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Este club todavía no ha definido su alineación.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {team.xi.map((slot) => (
        <span
          key={slot.slotId}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/40 px-2 py-1 text-xs"
        >
          <OvrBadge ovr={slot.ovr} />
          <span className="max-w-[10rem] truncate font-semibold">{slot.name}</span>
          <span className="text-[10px] text-muted-foreground">
            {POSITION_LABEL[slot.position]}
          </span>
        </span>
      ))}
    </div>
  );
}

function TeamSummary({
  team,
  mine = false,
}: {
  team: TeamSquadView | null;
  mine?: boolean;
}) {
  if (!team) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        {mine
          ? "Aún no presides ningún club."
          : "Este club todavía no tiene plantilla registrada."}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile icon={Users} label="Jugadores" value={String(team.stats.size)} />
        <StatTile icon={ScanSearch} label="OVR medio" value={String(team.stats.averageOvr)} />
        <StatTile icon={Shield} label="OVR del XI" value={String(team.xiOvr)} />
        <StatTile
          icon={BadgeEuro}
          label="Valor total"
          value={formatMoney(team.stats.totalValue)}
        />
      </div>
      <XiChips team={team} />
    </div>
  );
}

function TeamSquadDialog({
  club,
  team,
  onClose,
  rules,
}: {
  club: ClubView | null;
  team: TeamSquadView | null;
  onClose: () => void;
  rules: NonNullable<AppStateView["rules"]>;
}) {
  const limit = {
    GK: { min: rules.gkMin, max: rules.gkMax },
    DEF: { min: rules.defMin, max: rules.defMax },
    MID: { min: rules.midMin, max: rules.midMax },
    FWD: { min: rules.fwdMin, max: rules.fwdMax },
  };

  return (
    <Dialog open={Boolean(club)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden sm:max-w-2xl">
        {club ? (
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base">
              <Crest
                name={club.name}
                shortName={club.shortName}
                colors={[club.colorPrimary, club.colorSecondary]}
                size="sm"
              />
              <span className="display">{club.name}</span>
            </DialogTitle>
            <DialogDescription>
              {club.presidentNickname
                ? `Presidente ${club.presidentNickname} · ${club.league}`
                : `Club libre · ${club.league}`}
            </DialogDescription>
          </DialogHeader>
        ) : null}

        {team ? (
          <div className="scroll-thin -mx-1 min-h-0 flex-1 overflow-y-auto px-1">
            <div className="flex flex-col gap-4 pb-2">
              <div className="grid grid-cols-3 gap-2">
                <StatTile icon={Users} label="Jugadores" value={String(team.stats.size)} />
                <StatTile icon={ScanSearch} label="OVR medio" value={String(team.stats.averageOvr)} />
                <StatTile icon={Shield} label="OVR del XI" value={String(team.xiOvr)} />
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Once inicial ({team.formation})
                </p>
                <XiChips team={team} />
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Forma de la plantilla
                </p>
                <SquadShapeRow stats={team.stats} limits={limit} />
              </div>

              <SquadTable squad={team.squad} stats={team.stats} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CompareTable({
  mine,
  rival,
}: {
  mine: TeamSquadView;
  rival: TeamSquadView;
}) {
  return (
    <SectionCard title="Comparativa" icon={ArrowRightLeft} accent="gold" className="lg:col-span-2">
      <div className="overflow-x-auto scroll-thin">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Métrica</TableHead>
              <TableHead className="text-center">
                <span className="flex items-center justify-center gap-1.5">
                  <Crest name={mine.clubName} shortName={mine.clubShortName} colors={mine.clubColors} size="sm" />
                  <span className="max-w-[9rem] truncate">{mine.clubName}</span>
                </span>
              </TableHead>
              <TableHead className="text-center">
                <span className="flex items-center justify-center gap-1.5">
                  <Crest name={rival.clubName} shortName={rival.clubShortName} colors={rival.clubColors} size="sm" />
                  <span className="max-w-[9rem] truncate">{rival.clubName}</span>
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {COMPARE_ROWS.map((row) => {
              const mineValue = row.render(mine);
              const rivalValue = row.render(rival);
              const mineNum = Number(mineValue.replace(/[^\d.-]/g, ""));
              const rivalNum = Number(rivalValue.replace(/[^\d.-]/g, ""));
              const mineWins =
                row.better === null ||
                Number.isNaN(mineNum) ||
                Number.isNaN(rivalNum)
                  ? null
                  : row.better === "high"
                    ? mineNum > rivalNum
                    : mineNum < rivalNum;
              return (
                <TableRow key={row.key}>
                  <TableCell className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {row.label}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "num text-center text-sm font-semibold",
                      mineWins === true && "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {mineValue}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "num text-center text-sm font-semibold",
                      mineWins === false && "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {rivalValue}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        En verde se resalta el mejor valor de cada métrica.
      </p>
    </SectionCard>
  );
}

/**
 * Equipos (prompt IA: EQUIPOS → Todos los equipos / Plantillas / Comparar
 * equipos): club directory, public squad inspection and side-by-side
 * comparison against my own club.
 */
export default function Teams() {
  const state = useOutletContext<AppStateView>();
  const tournament = state.tournament;
  const myClub = state.club;
  const rules = state.rules;

  const [queryText, setQueryText] = useState("");
  const [mode, setMode] = useState<"todos" | "comparar">("todos");
  const [compareId, setCompareId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const compareClub = useMemo(
    () => state.clubs.find((club) => club.id === compareId) ?? null,
    [state.clubs, compareId],
  );
  const detailClub = useMemo(
    () => state.clubs.find((club) => club.id === detailId) ?? null,
    [state.clubs, detailId],
  );

  const mySquadQuery = useQuery(
    api.teams.squadOf,
    myClub ? { clubId: myClub.id } : "skip",
  );
  const compareSquadQuery = useQuery(
    api.teams.squadOf,
    compareClub && compareClub.id !== myClub?.id ? { clubId: compareClub.id } : "skip",
  );
  const detailSquadQuery = useQuery(
    api.teams.squadOf,
    detailClub ? { clubId: detailClub.id } : "skip",
  );

  const clubs = useMemo(() => {
    const text = queryText.trim().toLowerCase();
    const sorted = [...state.clubs].sort((a, b) => {
      if (myClub && a.id === myClub.id) return -1;
      if (myClub && b.id === myClub.id) return 1;
      return a.name.localeCompare(b.name);
    });
    if (!text) return sorted;
    return sorted.filter(
      (club) =>
        club.name.toLowerCase().includes(text) ||
        club.shortName.toLowerCase().includes(text) ||
        (club.presidentNickname ?? "").toLowerCase().includes(text),
    );
  }, [state.clubs, queryText, myClub]);

  if (!tournament || !rules) {
    return (
      <SectionCard title="Equipos">
        <p className="text-sm text-muted-foreground">
          El torneo todavía no está disponible. Vuelve al inicio.
        </p>
      </SectionCard>
    );
  }

  const showCompare = mode === "comparar" && Boolean(compareClub) && Boolean(myClub);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="display text-xl tracking-tight">Equipos</h1>
          <p className="text-xs text-muted-foreground">
            {state.clubs.length} clubes · {tournament.name} · {tournament.season}
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Input
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            placeholder="Buscar club o presidente…"
            className="h-10 flex-1 sm:w-60"
          />
          <Tabs
            value={mode}
            onValueChange={(value) => setMode(value as "todos" | "comparar")}
          >
            <TabsList>
              <TabsTrigger value="todos" className="cursor-pointer">
                Todos
              </TabsTrigger>
              <TabsTrigger
                value="comparar"
                disabled={!myClub}
                className="cursor-pointer"
              >
                Comparar
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {showCompare ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Mi club" icon={Shield} accent="brand">
            {mySquadQuery === undefined ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <TeamSummary team={mySquadQuery ?? null} mine />
            )}
          </SectionCard>

          <SectionCard
            title={compareClub?.name ?? "Rival"}
            icon={ArrowRightLeft}
            accent="pitch"
            action={
              compareClub ? { label: "Cambiar", to: "#equipos" } : undefined
            }
          >
            {compareSquadQuery === undefined ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <TeamSummary team={compareSquadQuery ?? null} />
            )}
          </SectionCard>

          {mySquadQuery && compareSquadQuery ? (
            <CompareTable mine={mySquadQuery} rival={compareSquadQuery} />
          ) : null}
        </div>
      ) : (
        <SectionCard title="Todos los equipos" icon={Users}>
          {mode === "comparar" && !compareClub ? (
            <p className="mb-3 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
              Elige un club de la lista con el botón «Comparar» para medirlo
              contra tu plantilla.
            </p>
          ) : null}
          <div className="flex flex-col divide-y">
            {clubs.map((club) => (
              <div key={club.id} className="flex items-center gap-3 py-3">
                <Crest
                  name={club.name}
                  shortName={club.shortName}
                  colors={[club.colorPrimary, club.colorSecondary]}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-bold">
                    {club.name}
                    {myClub && club.id === myClub.id ? (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                        Mi club
                      </span>
                    ) : null}
                    {!club.presidentNickname ? (
                      <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                        Libre
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {club.presidentNickname
                      ? `${club.presidentNickname} · ${club.league}`
                      : club.league}
                    {" · "}
                    {club.rosterSize} jugadores · OVR {club.averageOvr}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-9"
                    onClick={() => setDetailId(club.id)}
                  >
                    <Eye className="size-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Plantilla</span>
                  </Button>
                  {myClub && club.id !== myClub.id ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-9"
                      onClick={() => {
                        setCompareId(club.id);
                        setMode("comparar");
                      }}
                    >
                      <ArrowRightLeft className="size-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">Comparar</span>
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
            {clubs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Ningún club coincide con la búsqueda.
              </p>
            ) : null}
          </div>
        </SectionCard>
      )}

      <TeamSquadDialog
        club={detailClub}
        team={detailClub ? (detailSquadQuery ?? null) : null}
        onClose={() => setDetailId(null)}
        rules={rules}
      />
    </div>
  );
}
