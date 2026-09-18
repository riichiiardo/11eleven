import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { AppStateView, MarketPlayerView } from "@/convex/appTypes";
import type { MarketScope } from "@/convex/marketEngine";
import { MARKET_SCOPE_LABEL } from "@/convex/marketEngine";
import { formatMoney } from "@/convex/rulesEngine";
import { useQuery } from "convex/react";
import { useOutletContext } from "react-router";
import { SectionCard, StatTile } from "@/components/eleven/SectionCard";
import { OfferDialog } from "@/components/eleven/OfferDialog";
import { MarketPlayerCard } from "@/components/eleven/MarketPlayerCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BadgeEuro,
  Handshake,
  Loader2,
  Lock,
  Search,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SCOPES: MarketScope[] = ["todos", "libre", "clubes"];

const SORTS = [
  { value: "ovr", label: "Mejor OVR" },
  { value: "value", label: "Más valiosos" },
  { value: "age", label: "Más jóvenes" },
  { value: "name", label: "Nombre (A-Z)" },
] as const;

const GROUPS = [
  { value: "todos", label: "Todas las posiciones" },
  { value: "GK", label: "Porteros" },
  { value: "DEF", label: "Defensas" },
  { value: "MID", label: "Medios" },
  { value: "FWD", label: "Ataque" },
] as const;

export default function Market() {
  const state = useOutletContext<AppStateView>();
  const [scope, setScope] = useState<MarketScope>("todos");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<string>("todos");
  const [sort, setSort] = useState<string>("ovr");
  const [onlyAffordable, setOnlyAffordable] = useState(false);
  const [selected, setSelected] = useState<MarketPlayerView | null>(null);

  const marketOpen = state.tournament?.marketOpen ?? false;

  const players = useQuery(api.market.browse, {
    scope,
    search: search.trim() || undefined,
    group: group as "GK" | "DEF" | "MID" | "FWD" | "todos",
    sort: sort as "ovr" | "value" | "age" | "name",
    onlyAffordable,
    limit: 60,
  });

  const summary = state.market;

  const freeAgents = useMemo(
    () => (players ?? []).filter((player) => player.kind === "libre").length,
    [players],
  );

  const canTrade = countSellable(state);

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="display text-2xl">Mercado de jugadores</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Ficha agentes libres con presupuesto o negocia con otros Presidentes.
          Cada oferta se comprueba con el mismo reglamento que gobierna tu
          plantilla, así que sabrás por qué una operación no es posible antes de
          enviarla.
        </p>
      </header>

      <section
        aria-label="Resumen del mercado"
        className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
      >
        <StatTile
          icon={marketOpen ? Sparkles : Lock}
          tone={marketOpen ? "pitch" : "slate"}
          value={marketOpen ? "Abierto" : "Cerrado"}
          label="Ventana de mercado"
          hint={marketOpen ? "Las operaciones se ejecutan" : "Solo se reservan acuerdos"}
        />
        <StatTile
          icon={BadgeEuro}
          tone="gold"
          value={formatMoney(state.budget.available)}
          label="Presupuesto disponible"
          hint={`Inicial ${formatMoney(state.budget.initial)}`}
        />
        <StatTile
          icon={ShoppingBag}
          tone="brand"
          value={String(summary.freeAgents)}
          label="Agentes libres"
          hint={`${freeAgents} en la vista actual`}
        />
        <StatTile
          icon={Handshake}
          tone="brand"
          value={String(summary.received + summary.sent)}
          label="Negociaciones abiertas"
          hint={`${summary.received} recibidas · ${summary.sent} enviadas`}
        />
        <StatTile
          icon={Users}
          tone="slate"
          value={String(canTrade)}
          label="Jugadores que puedes ofrecer"
          hint="Sin romper cupos ni mínimos"
        />
      </section>

      <SectionCard
        title="Explorar jugadores"
        icon={Search}
        action={{ label: "Mis negociaciones", to: "/dashboard/mercado/negociaciones" }}
      >
        <div
          role="tablist"
          aria-label="Origen de los jugadores"
          className="flex flex-wrap gap-1.5"
        >
          {SCOPES.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={scope === option}
              onClick={() => setScope(option)}
              className={cn(
                "min-h-11 rounded-lg border px-3 text-sm font-semibold transition-colors",
                scope === option
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-accent",
              )}
            >
              {MARKET_SCOPE_LABEL[option]}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.6fr_1fr_1fr_auto] lg:items-end">
          <div className="flex flex-col gap-2">
            <Label htmlFor="market-search">Buscar</Label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id="market-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Jugador, nacionalidad, posición o club…"
                className="h-11 w-full rounded-lg border bg-card pl-9 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="market-group">Posición</Label>
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger id="market-group" className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUPS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="market-sort">Ordenar por</Label>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger id="market-sort" className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-h-11 items-center gap-2.5">
            <Switch
              id="market-affordable"
              checked={onlyAffordable}
              onCheckedChange={setOnlyAffordable}
            />
            <Label htmlFor="market-affordable" className="text-sm">
              Solo lo que puedo fichar
            </Label>
          </div>
        </div>
      </SectionCard>

      <section aria-label="Resultados del mercado" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display flex items-center gap-2 text-sm">
            <span aria-hidden="true" className="h-4 w-1 rounded-full bg-brand" />
            {players === undefined
              ? "Cargando jugadores…"
              : `${players.length} jugador(es) en ${MARKET_SCOPE_LABEL[scope].toLowerCase()}`}
          </h2>
          {players !== undefined && players.length > 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Presupuesto reservado: {formatMoney(summary.committedCash)}
            </p>
          ) : null}
        </div>

        {players === undefined ? (
          <div className="card-soft flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Consultando el catálogo del torneo…
          </div>
        ) : players.length === 0 ? (
          <EmptyMarket
            onReset={() => {
              setSearch("");
              setGroup("todos");
              setOnlyAffordable(false);
              setScope("todos");
            }}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {players.map((player) => (
              <li key={player.playerId}>
                <MarketPlayerCard
                  player={player}
                  budgetAvailable={state.budget.available}
                  onOffer={(target) => setSelected(target)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected ? (
        <OfferDialog
          key={selected.playerId}
          player={selected}
          squad={state.squad}
          budget={state.budget}
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        />
      ) : null}

      {marketOpen ? null : (
        <p className="rounded-lg border border-amber-500/35 bg-amber-500/[0.07] p-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
          La ventana de mercado está cerrada: puedes negociar y dejar acuerdos
          reservados, pero se aplicarán a las plantillas cuando Administración
          abra la ventana y superen la validación final.
        </p>
      )}
    </div>
  );
}

/** Players the President can actually put in a deal without breaking a cupo. */
function countSellable(state: AppStateView): number {
  const rules = state.rules;
  if (!rules) return 0;
  const limits = {
    GK: { min: rules.gkMin },
    DEF: { min: rules.defMin },
    MID: { min: rules.midMin },
    FWD: { min: rules.fwdMin },
  };
  const counts = state.stats?.groupCounts ?? { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  return (state.squad ?? []).filter(
    (player) => counts[player.group] - 1 >= limits[player.group].min,
  ).length;
}

function EmptyMarket({ onReset }: { onReset: () => void }) {
  return (
    <div className="card-soft flex flex-col items-start gap-3 p-6">
      <p className="text-sm font-semibold">
        No hay jugadores que cumplan estos filtros.
      </p>
      <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
        El mercado interno del torneo solo muestra jugadores de la base versionada
        y presidencias activas. Prueba a ampliar el origen, quitar el filtro de
        presupuesto o buscar por otro nombre.
      </p>
      <Button type="button" variant="outline" className="min-h-11" onClick={onReset}>
        Quitar filtros
      </Button>
    </div>
  );
}