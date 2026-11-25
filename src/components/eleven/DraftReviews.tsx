import { useEffect, useState } from "react";
import { rpc } from "@/infrastructure/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/domain/rulesEngine";
import { validSofifaUrl, type ReviewedEntry } from "@/lib/draft-prelist";

type ReviewEntry = ReviewedEntry & {
  name?: string;
  nationality?: string;
  position?: string;
  ovr?: number;
  seller?: string;
  available?: boolean;
};
type Departure = {
  playerId: string;
  name: string;
  presidentId: string;
  revision: string;
  destination: string | null;
  cash: number | null;
  pending: boolean;
  approved: boolean;
  offerType: string | null;
};
type ReviewTeam = {
  id: string;
  club: string;
  manager: string | null;
  players: Departure[];
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
  const [teams, setTeams] = useState<ReviewTeam[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = async () => {
    try {
      const [reviews, departures] = await Promise.all([
        rpc<ReviewData>("draft_review_state"),
        rpc<ReviewTeam[]>("review_departures"),
      ]);
      setData(reviews);
      setTeams(departures);
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
    Promise.all([
      rpc<ReviewData>("draft_review_state"),
      rpc<ReviewTeam[]>("review_departures"),
    ])
      .then((result) => {
        if (active) {
          setData(result[0]);
          setTeams(result[1]);
        }
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
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() =>
          void act(async () => {
            const count = await rpc<number>("draft_return_conflicts");
            return count;
          })
        }
      >
        Retornar altas ya elegidas por otro presidente
      </Button>
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
        <section aria-label="Bajas previstas por equipo" className="space-y-2">
          <h4 className="font-semibold">Bajas previstas por equipo</h4>
          <p className="text-sm text-muted-foreground">
            Si hay bajas o ventas registradas, puedes abrir el draft cuando al
            menos un presidente tenga todas las suyas aprobadas.
          </p>
          {teams?.map((team) => (
            <details key={team.id} className="rounded-lg border p-3">
              <summary className="cursor-pointer font-semibold">
                {team.club} · {team.players.length}{" "}
                {team.players.length === 1 ? "baja" : "bajas"} ·{" "}
                {team.manager ?? "Bot"}
              </summary>
              {team.players.length === 0 && (
                <p className="pt-2 text-sm">Sin bajas previstas.</p>
              )}
              <ul className="divide-y">
                {team.players.map((player) => (
                  <li
                    key={player.playerId}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <strong>{player.name}</strong>
                      <p className="text-sm">
                        {player.destination
                          ? `${player.offerType === "trade" ? "Intercambio" : "Venta"} a ${player.destination} · ${formatMoney(player.cash ?? 0)} · Ambos managers conformes`
                          : player.pending
                            ? "Negociación abierta · pendiente de acuerdo"
                            : "Rescisión prevista"}
                      </p>
                    </div>
                    {player.approved ? (
                      <div className="flex items-center gap-2">
                        <span>Aprobada</span>
                        <Button
                          type="button"
                          variant="outline"
                          aria-label={`Cancelar aprobación de ${player.name}`}
                          onClick={() =>
                            void act(() =>
                              rpc("revoke_departure_approval", {
                                p_president: player.presidentId,
                                p_player: player.playerId,
                                p_revision: player.revision,
                              }),
                            )
                          }
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        disabled={!player.destination && player.pending}
                        onClick={() =>
                          void act(() =>
                            rpc("approve_departure", {
                              p_president: player.presidentId,
                              p_player: player.playerId,
                              p_revision: player.revision,
                            }),
                          )
                        }
                      >
                        Aprobar baja
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </section>
        <h4 className="font-semibold">Altas enviadas a revisión</h4>
        {data?.lists.length === 0 && (
          <p>No hay prelistas pendientes de revisión.</p>
        )}
        {data?.lists.map((list) => (
          <section
            key={list.presidentId}
            className="space-y-3 rounded border p-3"
          >
            <h4 className="font-semibold">
              {list.president} · {list.entries.length} altas
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
