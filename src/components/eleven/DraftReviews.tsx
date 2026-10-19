import { useEffect, useState } from "react";
import { rpc } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/convex/rulesEngine";
import { validSofifaUrl, type ReviewedEntry } from "@/lib/draft-prelist";

type ReviewEntry = ReviewedEntry & {
  name?: string;
  nationality?: string;
  position?: string;
  ovr?: number;
  seller?: string;
  available?: boolean;
};
type ReviewData = {
  isAdmin: boolean;
  reviewers: string[];
  presidents: { userId: string; name: string }[];
  lists: {
    presidentId: string;
    president: string;
    revision: number;
    entries: ReviewEntry[];
    outgoing: string[];
  }[];
};

export function DraftReviews() {
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = async () => {
    try {
      setData(await rpc<ReviewData>("draft_review_state"));
      setError("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudieron cargar las revisiones.",
      );
    }
  };
  useEffect(() => {
    let active = true;
    rpc<ReviewData>("draft_review_state")
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron cargar las revisiones.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const act = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
      setNotice(
        "Cambio guardado. La respuesta está disponible para el presidente.",
      );
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar la revisión.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="space-y-4 rounded-lg border p-4"
      aria-label="Revisión de prelistas"
    >
      <h3 className="font-semibold">Revisión de prelistas del draft</h3>
      <p className="text-sm">
        Aprobar una preselección no ejecuta un fichaje. El rechazo requiere un
        motivo para que el presidente pueda corregirlo.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => void load()}
      >
        Actualizar revisiones
      </Button>
      {!data && !error && <p>Cargando revisiones…</p>}
      <fieldset disabled={busy} className="space-y-4">
        {data?.isAdmin && (
          <fieldset className="space-y-2">
            <legend>Designar revisores del draft</legend>
            {data.presidents.map((p) => (
              <label key={p.userId} className="flex gap-2 items-center">
                <input
                  type="checkbox"
                  checked={data.reviewers.includes(p.userId)}
                  onChange={(e) =>
                    void act(() =>
                      rpc("set_draft_reviewer", {
                        p_user_id: p.userId,
                        p_enabled: e.target.checked,
                      }),
                    )
                  }
                />
                {p.name}
              </label>
            ))}
          </fieldset>
        )}
        {data?.lists.length === 0 && (
          <p>No hay prelistas pendientes de revisión.</p>
        )}
        {data?.lists.map((list) => (
          <section
            key={list.presidentId}
            className="space-y-3 rounded border p-3"
          >
            <h4 className="font-semibold">
              {list.president} · {list.outgoing.length} bajas previstas
            </h4>
            {list.entries.map((entry) => {
              const noteKey = `${list.presidentId}:${entry.id}`;
              const decide = (approve: boolean) =>
                act(() =>
                  rpc("review_draft_entry", {
                    p_president_id: list.presidentId,
                    p_entry_id: entry.id,
                    p_revision: list.revision,
                    p_approve: approve,
                    p_note: notes[noteKey] ?? "",
                  }),
                );
              return (
                <div key={entry.id} className="space-y-2 rounded border p-3">
                  <p>
                    {entry.name ?? "Jugador no disponible"} ·{" "}
                    {formatMoney(entry.price)} · {entry.nationality} ·{" "}
                    {entry.kind === "new"
                      ? entry.positions.join(" / ")
                      : entry.position}{" "}
                    · Media {entry.ovr}
                  </p>
                  <p>
                    {entry.kind === "owned"
                      ? `Equipo vendedor: ${entry.seller ?? "No disponible"}`
                      : "Jugador nuevo · Datos declarados por el presidente"}
                  </p>
                  {validSofifaUrl(entry.sofifaUrl) && (
                    <a
                      href={entry.sofifaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Ficha en SoFIFA
                    </a>
                  )}
                  {entry.reviewStatus === "pending" ? (
                    <>
                      <Input
                        aria-label={`Motivo de revisión de ${entry.name ?? entry.id}`}
                        placeholder="Motivo (obligatorio al rechazar)"
                        maxLength={1000}
                        value={notes[noteKey] ?? ""}
                        onChange={(e) =>
                          setNotes({ ...notes, [noteKey]: e.target.value })
                        }
                      />
                      {entry.available === false && (
                        <p role="alert">
                          El jugador cambió de propietario. Rechaza esta
                          selección para que se corrija.
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          disabled={entry.available === false}
                          onClick={() => void decide(true)}
                        >
                          Aprobar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!notes[noteKey]?.trim()}
                          onClick={() => void decide(false)}
                        >
                          Rechazar
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p>
                      {entry.reviewStatus === "approved"
                        ? "Aprobada"
                        : "Rechazada"}
                      : {entry.reviewNote}
                    </p>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </fieldset>
    </section>
  );
}
