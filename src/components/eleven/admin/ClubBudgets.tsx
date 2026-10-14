import { useEffect, useState } from "react";
import { rpc } from "@/lib/supabase/client";
import { useMutation } from "@/convex-compat/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  onSaved,
}: {
  club: ClubBudget;
  onSaved: () => void;
}) {
  const [inherit, setInherit] = useState(club.override === null);
  const [amount, setAmount] = useState(String(club.override ?? club.initial));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const saveBudget = useMutation("tournament.setClubBudget");
  const save = async () => {
    const value = Number(amount);
    if (
      !inherit &&
      (!/^\d+(?:\.\d{1,2})?$/.test(amount.trim()) ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 2000000000)
    ) {
      setMessage(
        "Introduce un importe válido en euros, con hasta dos decimales.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await saveBudget({
        clubId: club.id,
        initialBudget: inherit ? null : value,
      });
      setMessage("Presupuesto guardado.");
      onSaved();
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "No se pudo guardar.",
      );
    } finally {
      setBusy(false);
    }
  };
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
          onChange={(e) => setInherit(e.target.checked)}
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
          disabled={inherit || busy}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button type="button" disabled={busy} onClick={() => void save()}>
          {busy ? "Guardando…" : "Guardar equipo"}
        </Button>
      </div>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
export function ClubBudgets({ generalBudget }: { generalBudget: number }) {
  const [clubs, setClubs] = useState<ClubBudget[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
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
            onSaved={() => setRevision((v) => v + 1)}
          />
        ))}
      </div>
    </div>
  );
}
