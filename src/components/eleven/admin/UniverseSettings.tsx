import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { SectionCard } from "@/components/eleven/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rpc } from "@/infrastructure/supabase/client";
import { errorMessage } from "@/lib/errors";
import { queryStore } from "@/services/backend/query-store";

type Club = { id: string; name: string };

export function UniverseSettings({ name }: { name: string }) {
  const [newName, setNewName] = useState(name);
  const [pool, setPool] = useState<Club[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [poolError, setPoolError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    rpc<Club[]>("admin_universe_pool").then(
      (clubs) => {
        if (active) setPool(clubs);
      },
      (cause) => {
        if (active) setPoolError(errorMessage(cause));
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  async function save(
    event: FormEvent<HTMLFormElement>,
    action: "name" | "club",
  ) {
    event.preventDefault();
    setBusy(true);
    try {
      if (action === "name") {
        await rpc("admin_rename_universe", { p_name: newName.trim() });
        toast.success("Nombre del universo guardado");
      } else {
        await rpc("admin_include_universe_club", { p_club: selected });
        setPool((clubs) => clubs.filter((club) => club.id !== selected));
        setSelected("");
        toast.success("Club incorporado al universo");
      }
      queryStore.invalidateAll();
    } catch (cause) {
      toast.error(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title="Configuración del universo">
      <div className="space-y-4">
        <form
          onSubmit={(event) => void save(event, "name")}
          className="flex flex-wrap items-end gap-2"
        >
          <label className="space-y-1">
            Nombre del universo
            <Input
              required
              maxLength={100}
              value={newName}
              disabled={busy}
              onChange={(event) => setNewName(event.target.value)}
            />
          </label>
          <Button disabled={busy || !newName.trim() || newName.trim() === name}>
            Guardar nombre
          </Button>
        </form>
        <form
          onSubmit={(event) => void save(event, "club")}
          className="flex flex-wrap items-end gap-2"
        >
          <label className="grid gap-1">
            Club fuera del universo
            <select
              className="rounded-md border bg-background p-2"
              value={selected}
              disabled={busy || !pool.length}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="">Selecciona un club del pool</option>
              {pool.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={busy || !selected}>Incorporar al universo</Button>
        </form>
        {poolError && (
          <div className="flex items-center gap-2">
            <p role="alert">{poolError}</p>
            <Button
              variant="outline"
              onClick={() => {
                setPoolError("");
                setAttempt((n) => n + 1);
              }}
            >
              Reintentar
            </Button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
