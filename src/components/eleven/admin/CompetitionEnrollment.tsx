import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/eleven/SectionCard";
import { errorMessage } from "@/lib/errors";
import { rpc } from "@/infrastructure/supabase/client";

type Competition = { id: string; name: string };
type Club = Competition & { competitions: string[] };
type Enrollment = { clubs: Club[]; competitions: Competition[] };

function ClubEnrollment({
  club,
  competitions,
}: {
  club: Club;
  competitions: Competition[];
}) {
  const [saved, setSaved] = useState(club.competitions);
  const [selected, setSelected] = useState(saved);
  const [busy, setBusy] = useState(false);
  const dirty =
    selected.length !== saved.length ||
    selected.some((id) => !saved.includes(id));

  async function save() {
    setBusy(true);
    try {
      await rpc("admin_save_competition_enrollment", {
        p_club: club.id,
        p_competitions: selected,
      });
      setSaved(selected);
      toast.success("Inscripciones guardadas", { description: club.name });
    } catch (cause) {
      toast.error("No se pudieron guardar las inscripciones", {
        description: errorMessage(cause),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="grid gap-2 border-b py-3 sm:grid-cols-2">
      <strong>{club.name}</strong>
      <details className="rounded-md border p-2">
        <summary className="cursor-pointer">
          {saved.length
            ? competitions
                .filter((c) => saved.includes(c.id))
                .map((c) => c.name)
                .join(", ")
            : "Sin competiciones inscritas"}
        </summary>
        <fieldset disabled={busy} className="space-y-2 px-2 pt-2">
          <legend className="sr-only">Competiciones de {club.name}</legend>
          {competitions.map((c) => (
            <label key={c.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, c.id]
                      : selected.filter((id) => id !== c.id),
                  )
                }
              />
              {c.name}
            </label>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!dirty || busy}
              onClick={() => void save()}
            >
              {busy ? "Guardando…" : "Guardar inscripciones"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!dirty || busy}
              onClick={() => setSelected(saved)}
            >
              Cancelar
            </Button>
          </div>
        </fieldset>
      </details>
    </li>
  );
}

export function CompetitionEnrollment() {
  const [data, setData] = useState<Enrollment>();
  const [error, setError] = useState("");
  const [attempt, retry] = useState(0);

  useEffect(() => {
    let current = true;
    rpc<Enrollment>("admin_competition_enrollment")
      .then((result) => {
        if (current) setData(result);
      })
      .catch((cause) => {
        if (current) setError(errorMessage(cause));
      });
    return () => {
      current = false;
    };
  }, [attempt]);

  return (
    <SectionCard title="Competiciones por equipo" icon={Trophy}>
      {error ? (
        <div>
          <p role="alert">{error}</p>
          <Button
            onClick={() => {
              setError("");
              retry((n) => n + 1);
            }}
          >
            Reintentar
          </Button>
        </div>
      ) : !data ? (
        <p role="status">Cargando inscripciones…</p>
      ) : !data.competitions.length ? (
        <p>Configura una competición en Reglas para inscribir equipos.</p>
      ) : !data.clubs.length ? (
        <p>Este universo aún no tiene equipos.</p>
      ) : (
        <ul>
          {data.clubs.map((club) => (
            <ClubEnrollment
              key={club.id}
              club={club}
              competitions={data.competitions}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
