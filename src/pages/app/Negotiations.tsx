import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { AppStateView, OfferView } from "@/convex/appTypes";
import { formatMoney } from "@/convex/rulesEngine";
import { useQuery } from "convex/react";
import { useOutletContext } from "react-router";
import { SectionCard, StatTile } from "@/components/eleven/SectionCard";
import { OfferCard } from "@/components/eleven/OfferCard";
import {
  BadgeEuro,
  Handshake,
  Inbox,
  Loader2,
  Send,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "recibidas" | "enviadas" | "reservadas" | "historial";

const TABS: Array<{ id: Tab; label: string; icon: typeof Inbox }> = [
  { id: "recibidas", label: "Recibidas", icon: Inbox },
  { id: "enviadas", label: "Enviadas", icon: Send },
  { id: "reservadas", label: "Reservadas", icon: Timer },
  { id: "historial", label: "Historial", icon: ShieldCheck },
];

export default function Negotiations() {
  const state = useOutletContext<AppStateView>();
  const [tab, setTab] = useState<Tab>("recibidas");
  const overview = useQuery(api.market.overview);

  const offers: OfferView[] =
    overview === undefined || overview === null
      ? []
      : tab === "recibidas"
        ? overview.received
        : tab === "enviadas"
          ? overview.sent
          : tab === "reservadas"
            ? overview.reserved
            : overview.history;

  const counts: Record<Tab, number> = {
    recibidas: overview?.received.length ?? 0,
    enviadas: overview?.sent.length ?? 0,
    reservadas: overview?.reserved.length ?? 0,
    historial: overview?.history.length ?? 0,
  };

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="display text-2xl">Negociaciones</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Un acuerdo aceptado no se aplica de inmediato: queda reservado y los
          jugadores implicados se comprometen hasta la validación final, de modo
          que nadie pueda vender al mismo jugador dos veces.
        </p>
      </header>

      <section
        aria-label="Resumen de negociaciones"
        className="grid gap-3 grid-cols-2 md:grid-cols-4"
      >
        <StatTile
          icon={Inbox}
          tone={counts.recibidas > 0 ? "gold" : "slate"}
          value={String(counts.recibidas)}
          label="Esperan tu respuesta"
          hint={counts.recibidas > 0 ? "Alguien quiere negociar" : "Nada pendiente"}
        />
        <StatTile
          icon={Send}
          tone="brand"
          value={String(counts.enviadas)}
          label="Enviadas por ti"
          hint="Pendientes de respuesta"
        />
        <StatTile
          icon={Timer}
          tone="brand"
          value={String(counts.reservadas)}
          label="Acuerdos reservados"
          hint="Se ejecutan con la validación final"
        />
        <StatTile
          icon={BadgeEuro}
          tone="slate"
          value={formatMoney(state.market.committedCash)}
          label="Presupuesto comprometido"
          hint={`Disponible ${formatMoney(state.budget.available)}`}
        />
      </section>

      <div
        role="tablist"
        aria-label="Estado de las negociaciones"
        className="flex flex-wrap gap-1.5"
      >
        {TABS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            onClick={() => setTab(option.id)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors",
              tab === option.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            <option.icon className="size-4" aria-hidden="true" />
            {option.label}
            <span className="num rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">
              {counts[option.id]}
            </span>
          </button>
        ))}
      </div>

      <SectionCard
        title={
          tab === "historial"
            ? "Operaciones cerradas"
            : tab === "reservadas"
              ? "Acuerdos reservados por el torneo"
              : `Ofertas ${tab}`
        }
        icon={Handshake}
        action={{ label: "Explorar mercado", to: "/dashboard/mercado" }}
      >
        {overview === undefined ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Cargando tus negociaciones…
          </p>
        ) : offers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tab === "recibidas"
              ? "No hay ofertas esperando tu respuesta. Mientras tanto puedes explorar el mercado."
              : tab === "enviadas"
                ? "No tienes ofertas pendientes de respuesta."
                : tab === "reservadas"
                  ? "No tienes acuerdos reservados. Cuando aceptes una operación aparecerá aquí hasta ejecutarse."
                  : "Todavía no se ha cerrado ninguna operación tuya."}
          </p>
        ) : (
          <ul className="grid gap-3 xl:grid-cols-2">
            {offers.map((offer) => (
              <li key={offer.id}>
                <OfferCard offer={offer} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
