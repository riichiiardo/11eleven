import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { AppStateView, DraftPoolPlayerView } from "@/convex/appTypes";
import {
  GROUP_LABEL,
  POSITION_LABEL,
  formatMoney,
  type PositionGroup,
} from "@/convex/rulesEngine";
import { useOutletContext } from "react-router";
import { useQuery } from "convex/react";
import { relativeTime } from "@/lib/errors";
import { useNow } from "@/hooks/use-tournament";
import { useDraftActions } from "@/hooks/use-draft-actions";
import { SectionCard, StatTile } from "@/components/eleven/SectionCard";
import { DraftStatusPill, TurnStrip } from "@/components/eleven/DraftBits";
import { PlayerAvatar, PositionPill } from "@/components/eleven/PlayerBits";
import { RuleCheckList } from "@/components/eleven/RuleCheckList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Clock,
  Coins,
  Gavel,
  History,
  Info,
  Loader2,
  Search,
  ShieldCheck,
  ShoppingCart,
  Users,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Draft Control Center (prompt §11). The President sees whose turn it is, how
 * long that turn has left, what the pool offers and — only when it is their
 * turn — a picker with the same live checks the mutation will re-run.
 */
export default function Draft() {
  useOutletContext<AppStateView>();
  const now = useNow(1000);
  const control = useQuery(api.draft.control);
  const [group, setGroup] = useState<PositionGroup | "todos">("todos");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"ovr" | "value" | "age" | "name">("ovr");
  const [target, setTarget] = useState<DraftPoolPlayerView | null>(null);
  const { pick, busyKey } = useDraftActions();

  const summary = control?.summary ?? null;
  const draftActive = summary?.status === "en_curso";
  const myTurn = Boolean(summary?.isMyTurn);

  const pool = useQuery(
    api.draft.pool,
    draftActive
      ? {
          search: search.trim() || undefined,
          group: group === "todos" ? undefined : group,
          sort,
          limit: 60,
        }
      : "skip",
  );

  const banner = useMemo(() => {
    if (!summary || summary.status === null) {
      return {
        tone: "muted" as const,
        icon: Info,
        title: "El draft no está preparado",
        detail:
          "Administración definirá el orden de turnos y lo abrirá cuando el mercado esté listo. Te avisaremos aquí mismo.",
      };
    }
    if (summary.status === "borrador") {
      return {
        tone: "muted" as const,
        icon: Info,
        title: "Draft preparado · esperando apertura",
        detail:
          "El orden de turnos ya está aprobado pero el draft sigue cerrado. Cuando Administración lo abra, el primer Presidente tendrá el turno.",
      };
    }
    if (summary.status === "pausado") {
      return {
        tone: "warning" as const,
        icon: Clock,
        title: "Draft en pausa",
        detail:
          "El reloj está detenido y nadie puede fichar hasta que Administración reanude los turnos.",
      };
    }
    if (summary.status === "cerrado") {
      return {
        tone: "muted" as const,
        icon: History,
        title: "Draft cerrado · plantillas bloqueadas",
        detail: `${summary.totalPicks} adquisición(es) registradas. Ahora solo puedes ajustar tu once en Formación.`,
      };
    }
    if (myTurn) {
      return {
        tone: "positive" as const,
        icon: Gavel,
        title: "¡Es tu turno!",
        detail:
          "Elige un jugador del pool disponible. La operación se valida contra las reglas antes de aplicarse.",
      };
    }
    return {
      tone: "info" as const,
      icon: Clock,
      title: `Turno de ${summary.currentNickname ?? "otro Presidente"}`,
      detail:
        "El pool se actualiza al instante: si alguien ficha a un jugador, desaparece de tu lista en cuanto lo confirma.",
    };
  }, [summary, myTurn]);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="display text-2xl">Draft</h1>
          <DraftStatusPill status={summary?.status ?? null} />
          {summary && summary.status !== null ? (
            <Badge variant="outline">
              Ronda {summary.round} de {summary.totalRounds}
            </Badge>
          ) : null}
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Turnos cronometrados: cada adquisición se refleja en tiempo real para
          todo el torneo, y los acuerdos reservados del mercado se ejecutan al
          abrir el draft.
        </p>
      </header>

      {/* Banner: the state machine speaking in one sentence (prompt §5/§31). */}
      <div
        role="status"
        className={cn(
          "flex items-start gap-3 rounded-xl border p-4",
          banner.tone === "positive" &&
            "border-emerald-500/40 bg-emerald-500/[0.07]",
          banner.tone === "warning" && "border-amber-500/40 bg-amber-500/[0.06]",
          banner.tone === "info" && "border-primary/30 bg-primary/[0.05]",
          banner.tone === "muted" && "border-border bg-card",
        )}
      >
        <banner.icon
          aria-hidden="true"
          className={cn(
            "mt-0.5 size-5 shrink-0",
            banner.tone === "positive" &&
              "text-emerald-600 dark:text-emerald-300",
            banner.tone === "warning" && "text-amber-600 dark:text-amber-300",
            banner.tone === "info" && "text-primary",
            banner.tone === "muted" && "text-muted-foreground",
          )}
        />
        <div className="min-w-0">
          <p className="text-sm font-bold">{banner.title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{banner.detail}</p>
          {summary && summary.status === "en_curso" && summary.currentDeadline !== null ? (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Turno de {summary.currentNickname}
              <CountdownInline target={summary.currentDeadline} now={now} />
            </p>
          ) : null}
        </div>
      </div>

      {summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile
            icon={Users}
            label="Plantilla"
            value={`${summary.squadSize}/${summary.squadSizeLimit}`}
          />
          <StatTile
            icon={Coins}
            label="Presupuesto"
            value={formatMoney(summary.myBudget)}
          />
          <StatTile
            icon={Search}
            label="Pool libre"
            value={`${summary.poolSize}`}
          />
          <StatTile
            icon={ShoppingCart}
            label="Fichajes del draft"
            value={`${summary.totalPicks}`}
          />
          <StatTile
            icon={ShieldCheck}
            label="Reservadas ejecutadas"
            value={`${summary.executedReserved}`}
          />
          <StatTile
            icon={UserX}
            label="Reservadas invalidadas"
            value={`${summary.invalidatedReserved}`}
          />
        </div>
      ) : null}

      <TurnStrip order={control?.turnOrder ?? []} />

      {draftActive ? (
        <SectionCard
          title={
            myTurn
              ? "Jugadores disponibles · elige tu fichaje"
              : "Jugadores disponibles"
          }
          icon={Gavel}
        >
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="draft-search" className="text-xs">
                Buscar
              </Label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="draft-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nombre, club real, país…"
                  className="h-11 pl-9"
                  disabled={!myTurn}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="draft-group" className="text-xs">
                Posición
              </Label>
              <Select
                value={group}
                onValueChange={(value) =>
                  setGroup(value as PositionGroup | "todos")
                }
                disabled={!myTurn}
              >
                <SelectTrigger id="draft-group" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="GK">{GROUP_LABEL.GK}</SelectItem>
                  <SelectItem value="DEF">{GROUP_LABEL.DEF}</SelectItem>
                  <SelectItem value="MID">{GROUP_LABEL.MID}</SelectItem>
                  <SelectItem value="FWD">{GROUP_LABEL.FWD}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="draft-sort" className="text-xs">
                Ordenar por
              </Label>
              <Select
                value={sort}
                onValueChange={(value) => setSort(value as typeof sort)}
                disabled={!myTurn}
              >
                <SelectTrigger id="draft-sort" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ovr">Media OVR</SelectItem>
                  <SelectItem value="value">Valor</SelectItem>
                  <SelectItem value="age">Edad</SelectItem>
                  <SelectItem value="name">Nombre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {pool === undefined ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Cargando jugadores disponibles…
            </div>
          ) : pool.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">
              No hay jugadores que coincidan con la búsqueda.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {pool.map((player) => (
                <li key={player.playerId}>
                  <PoolCard
                    player={player}
                    disabled={!myTurn}
                    onSelect={() => setTarget(player)}
                  />
                </li>
              ))}
            </ul>
          )}
          {!myTurn ? (
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Los fichajes se habilitan cuando el turno sea tuyo. Mientras tanto
              puedes seguir el estado del draft y el historial de adquisiciones.
            </p>
          ) : null}
        </SectionCard>
      ) : null}

      <SectionCard
        title="Historial de adquisiciones"
        icon={History}
        bodyClassName={(control?.picks.length ?? 0) === 0 ? undefined : "p-0"}
      >
        {control === undefined ? (
          <p className="text-sm text-muted-foreground">Cargando historial…</p>
        ) : !control || control.picks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay adquisiciones en el draft. Cada fichaje quedará
            registrado aquí con su Presidente, su precio y su ronda.
          </p>
        ) : (
          <ul className="divide-y">
            {control.picks
              .slice()
              .reverse()
              .slice(0, 25)
              .map((pickRow) => (
                <li
                  key={pickRow.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <span className="num flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold">
                    {pickRow.pickNumber}
                  </span>
                  <PlayerAvatar
                    name={pickRow.playerName}
                    flag={pickRow.flag}
                    group={pickRow.group}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {pickRow.playerName}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        {POSITION_LABEL[pickRow.position]} · {pickRow.realClub}
                      </span>
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      Ronda {pickRow.round} · {pickRow.nickname} (
                      {pickRow.clubName}) · {relativeTime(pickRow.pickedAt, now)}
                      {pickRow.mode === "reserva"
                        ? " · acuerdo reservado del mercado"
                        : ""}
                    </p>
                  </div>
                  <span className="num text-sm font-bold text-brand">
                    {formatMoney(pickRow.price)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </SectionCard>

      <PickDialog
        player={target}
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        onConfirm={async (player) => {
          const result = await pick(player.playerId);
          if (result) setTarget(null);
        }}
        busy={busyKey !== null}
      />
    </div>
  );
}

/** Small "mm:ss" inline countdown for the current turn. */
function CountdownInline({ target, now }: { target: number; now: number }) {
  const secondsLeft = Math.max(0, Math.ceil((target - now) / 1000));
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const urgent = secondsLeft <= 30;
  return (
    <span
      className={cn(
        "num rounded-md px-1.5 py-0.5 text-xs normal-case tracking-normal",
        urgent
          ? "bg-rose-500/15 font-bold text-rose-700 dark:text-rose-300"
          : "bg-muted font-semibold text-foreground",
      )}
    >
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      <span className="sr-only"> restantes en el turno</span>
    </span>
  );
}

/** One candidate in the pool: identity, price and why it can/cannot be picked. */
function PoolCard({
  player,
  disabled,
  onSelect,
}: {
  player: DraftPoolPlayerView;
  disabled: boolean;
  onSelect: () => void;
}) {
  const blocked = !player.offerable;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "flex h-full w-full flex-col gap-2 rounded-xl border bg-card p-3 text-left transition-colors",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "hover:border-primary/50 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex items-center gap-2.5">
        <PlayerAvatar
          name={player.name}
          flag={player.flag}
          group={player.group}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{player.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {player.realClub} · {player.age} años
          </p>
        </div>
        <span className="num rounded-lg bg-navy px-2 py-1 text-xs font-bold text-white">
          {player.ovr}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PositionPill position={player.position} group={player.group} />
        <span className="num text-xs font-semibold text-muted-foreground">
          Precio {formatMoney(player.price)}
        </span>
      </div>
      {blocked && player.blockedReason ? (
        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          {player.blockedReason}
        </p>
      ) : null}
    </button>
  );
}

/** Confirmation with the same checks the server will re-run at pick time. */
function PickDialog({
  player,
  open,
  onOpenChange,
  onConfirm,
  busy,
}: {
  player: DraftPoolPlayerView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (player: DraftPoolPlayerView) => Promise<void>;
  busy: boolean;
}) {
  const check = useQuery(
    api.draft.check,
    player ? { playerId: player.playerId } : "skip",
  );

  const passed = check?.passed ?? false;
  const canConfirm = Boolean(check) && passed && check?.isMyTurn && !busy;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto scroll-thin sm:max-w-lg">
        {player ? (
          <>
            <DialogHeader>
              <DialogTitle className="display text-base">
                Fichar a {player.name}
              </DialogTitle>
              <DialogDescription>
                {player.realClub} · {POSITION_LABEL[player.position]} · OVR{" "}
                {player.ovr} · {player.age} años
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between gap-3 rounded-xl border bg-gradient-to-br from-navy to-navy-deep p-4 text-white">
              <PlayerAvatar
                name={player.name}
                flag={player.flag}
                group={player.group}
                size="lg"
              />
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                  Coste del fichaje
                </p>
                <p className="num text-2xl font-bold text-brand-bright">
                  {formatMoney(player.price)}
                </p>
              </div>
            </div>

            {check === undefined ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Comprobando disponibilidad y reglas…
              </p>
            ) : check === null ? (
              <p className="text-sm text-muted-foreground">
                La comprobación no está disponible para tu cuenta.
              </p>
            ) : check.unavailableReason ? (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/[0.06] p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="size-4" aria-hidden="true" />
                  Jugador no disponible
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {check.unavailableReason}
                </p>
              </div>
            ) : (
              <>
                {check?.isMyTurn ? null : (
                  <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.06] p-3 text-xs text-amber-800 dark:text-amber-200">
                    <AlertTriangle
                      className="mt-0.5 size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    No es tu turno todavía: espera a que te toque para confirmar.
                  </p>
                )}
                <RuleCheckList checks={check.checks} variant="compact" />
                <Separator />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Al confirmar, el precio se descuenta de tu presupuesto y el
                  jugador pasa a tu plantilla. Todo queda registrado en la
                  auditoría del torneo.
                </p>
              </>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="min-h-11"
                disabled={!canConfirm}
                onClick={() => {
                  void onConfirm(player);
                }}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Gavel className="size-4" aria-hidden="true" />
                )}
                Confirmar fichaje · {formatMoney(player.price)}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
