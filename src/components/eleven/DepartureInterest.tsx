import { Link } from "react-router";
import { bidMoney, type DepartureBid } from "@/hooks/use-departure-bids";
const status: Record<string, string> = {
  enviada: "Oferta recibida",
  negociacion: "En negociación",
  aceptada: "Aceptada",
  reservada: "Acuerdo reservado",
};
export function DepartureInterest({ bid }: { bid?: DepartureBid }) {
  return (
    <div className="mt-2 space-y-2 rounded border bg-muted/30 p-3">
      <p className="font-semibold">
        {bid?.closed
          ? "Baja negociada · puja cerrada"
          : bid?.count
            ? `${bid.count} equipo(s) interesado(s) · decisión pendiente`
            : "Sin ofertas activas"}
      </p>
      {bid?.highestCash != null && (
        <p>Mayor oferta individual en efectivo: {bidMoney(bid.highestCash)}</p>
      )}
      <ul className="space-y-2">
        {bid?.offers.map((offer) => (
          <li key={offer.id} className="rounded border bg-background p-2">
            <p className="font-medium">
              {offer.club} · {bidMoney(offer.cash)} ·{" "}
              {status[offer.status] ?? offer.status}
            </p>
            {offer.package && (
              <p className="text-xs text-muted-foreground">
                Importe total de la operación, no precio individual. Solicita:{" "}
                {offer.requested.join(", ")}. Ofrece:{" "}
                {offer.offered.join(", ") || "solo efectivo"}.
              </p>
            )}
            <Link
              className="underline underline-offset-2"
              to={`/dashboard/mercado/negociaciones?tab=${bid.closed ? "reservadas" : "recibidas"}#oferta-${offer.id}`}
            >
              {bid.closed ? "Consultar acuerdo" : "Revisar oferta y decidir"}
            </Link>
          </li>
        ))}
      </ul>
      {!bid?.closed && (
        <p className="text-xs text-muted-foreground">
          El propietario elige qué oferta aceptar. Ninguna puja gana
          automáticamente ni impide la rescisión por sí sola.
        </p>
      )}
    </div>
  );
}
