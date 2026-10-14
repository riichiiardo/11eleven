import { useEffect, useState } from "react";
import { rpc } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/convex/rulesEngine";

type ClubBudget = {
  id: string;
  name: string;
  override: number | null;
  initial: number;
  assigned: boolean;
};
function ClubBudgetRow({
  club,
  draft,
  onChange,
}: {
  club: ClubBudget;
  draft: string | null | undefined;
  onChange: (value: string | null) => void;
}) {
  const inherit = (draft === undefined ? club.override : draft) === null;
  const amount =
    typeof draft === "string" ? draft : String(club.override ?? club.initial);
  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div>
        <h3 className="font-semibold">{club.name}</h3>
        <p className="text-sm">
          Inicial vigente: {formatMoney(club.initial)} ·{" "}
          {club.assigned ? "Con presidente" : "Sin presidente"}
        </p>
      </div>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={inherit}
          onChange={(e) =>
            onChange(
              e.target.checked ? null : String(club.override ?? club.initial),
            )
          }
        />
        Usar presupuesto general
      </label>
      <div className="flex gap-2 items-center">
        <span>€</span>
        <Input
          aria-label={`Presupuesto de ${club.name} en euros`}
          type="number"
          min={0}
          max={2000000000}
          step="0.01"
          disabled={inherit}
          value={amount}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
export function ClubBudgets({
  generalBudget,
  drafts,
  onChange,
  revision,
}: {
  generalBudget: number;
  drafts: Record<string, string | null>;
  onChange: (id: string, value: string | null) => void;
  revision: number;
}) {
  const [clubs, setClubs] = useState<ClubBudget[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    rpc<ClubBudget[]>("club_budgets")
      .then((data) => {
        if (active) {
          setClubs(data);
          setError("");
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudieron cargar los equipos.",
          );
      });
    return () => {
      active = false;
    };
  }, [generalBudget, revision]);
  return (
    <div className="mt-4 space-y-4">
      <h3 className="font-semibold">Presupuesto independiente por equipo</h3>
      <p className="text-sm text-muted-foreground">
        Cada equipo puede heredar el general o tener un importe propio. Cambiar
        el inicial ajusta el saldo por la diferencia y conserva gastos e
        ingresos anteriores. No permite dejar saldo insuficiente para
        compromisos vigentes.
      </p>
      {error && <p role="alert">{error}</p>}
      {clubs === null && !error && (
        <p role="status">Cargando presupuestos de los equipos…</p>
      )}
      {clubs?.length === 0 && <p>Este Universo todavía no tiene equipos.</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {clubs?.map((club) => (
          <ClubBudgetRow
            key={`${club.id}:${club.initial}:${club.override}`}
            club={club}
            draft={drafts[club.id]}
            onChange={(value) => onChange(club.id, value)}
          />
        ))}
      </div>
    </div>
  );
}
