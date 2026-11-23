import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { rpc } from "@/infrastructure/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/eleven/SectionCard";

type Row = {
  id: string;
  name: string;
  nationality: string;
  ovr: number;
  blocked: boolean;
};

export function SigningEligibility() {
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    const timer = window.setTimeout(() => {
      rpc<Row[]>("admin_signing_players", { p_search: term })
        .then((result) => {
          if (current) {
            setRows(result);
            setError("");
          }
        })
        .catch((e) => {
          if (current) setError(e.message);
        });
    }, 180);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [term, revision]);
  async function change(row: Row) {
    setBusy(true);
    try {
      await rpc("admin_set_signing_block", {
        p_player: row.id,
        p_blocked: !row.blocked,
      });
      setRows((old) =>
        old.map((p) => (p.id === row.id ? { ...p, blocked: !row.blocked } : p)),
      );
      setRevision((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <SectionCard title="Bloqueos de fichajes" icon={ShieldCheck}>
      <label>
        Buscar jugador por nombre o ID de SoFIFA
        <Input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Deja vacío para ver los bloqueados"
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <ul className="divide-y">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex items-center justify-between gap-3 py-2"
          >
            <span>
              {row.name} · {row.nationality} · {row.ovr}
            </span>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => change(row)}
            >
              {row.blocked ? "Desbloquear" : "Bloquear"}
            </Button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
