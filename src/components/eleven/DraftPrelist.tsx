import { useEffect, useState } from "react";
import { rpc } from "@/lib/supabase/client";
import {
  DRAFT_POSITIONS,
  prelistEntrySchema,
  validatePrelist,
  type PrelistData,
} from "@/lib/draft-prelist";
import { SectionCard } from "@/components/eleven/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClipboardList } from "lucide-react";
import { formatMoney } from "@/convex/rulesEngine";
import { DraftReviews } from "./DraftReviews";

const selectClass = "w-full min-h-11 rounded-md border bg-background p-2";

export function DraftPrelist() {
  const [data, setData] = useState<PrelistData | null>(null);
  const [saved, setSaved] = useState<PrelistData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [kind, setKind] = useState<"owned" | "new">("owned");
  const [clubId, setClubId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [price, setPrice] = useState("");
  const [sofifaUrl, setSofifaUrl] = useState("");
  const [name, setName] = useState("");
  const [ovr, setOvr] = useState("");
  const [nationality, setNationality] = useState("");
  const [positions, setPositions] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    rpc<PrelistData>("draft_prelist_state")
      .then((result) => {
        if (active) {
          setData(result);
          setSaved(result);
          setError("");
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar la prelista.",
          );
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const player = data?.players.find(
    (p) => p.id === playerId && p.clubId === clubId,
  );
  const dirty =
    JSON.stringify([data?.entries, data?.outgoing]) !==
    JSON.stringify([saved?.entries, saved?.outgoing]);
  const resetForm = () => {
    setEditingId(null);
    setPlayerId("");
    setPrice("");
    setSofifaUrl("");
    setName("");
    setOvr("");
    setNationality("");
    setPositions([]);
  };
  const hasData = data !== null;
  useEffect(() => {
    if (!hasData || dirty || busy) return;
    let active = true;
    const timer = window.setInterval(() => {
      rpc<PrelistData>("draft_prelist_state")
        .then((result) => {
          if (active) {
            setData(result);
            setSaved(result);
          }
        })
        .catch(() => {
          /* Keep the saved list visible during a transient network failure. */
        });
    }, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [hasData, dirty, busy]);
  const add = () => {
    if (!data) return;
    const parsed = prelistEntrySchema.safeParse(
      kind === "owned"
        ? { kind, clubId, playerId, price: Number(price), sofifaUrl }
        : {
            kind,
            name,
            price: Number(price),
            ovr: Number(ovr),
            nationality,
            positions,
          },
    );
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(" "));
      return;
    }
    if (kind === "owned" && !player) {
      setError("Selecciona un jugador del equipo indicado.");
      return;
    }
    try {
      const item = {
        ...parsed.data,
        id: editingId ?? crypto.randomUUID(),
        reviewStatus: "pending" as const,
        reviewNote: "",
      };
      const entries = editingId
        ? data.entries.map((e) => (e.id === editingId ? item : e))
        : [...data.entries, item];
      validatePrelist(entries, data.outgoing, data.limit);
      setData({ ...data, entries });
      setError("");
      setNotice("");
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revisa los datos.");
    }
  };
  const save = async (submit = false) => {
    if (!data) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      validatePrelist(data.entries, data.outgoing, data.limit);
      await rpc<number>("save_draft_prelist", {
        p_entries: data.entries,
        p_outgoing: data.outgoing,
        p_revision: data.revision,
        p_submit: submit,
      });
      const next = await rpc<PrelistData>("draft_prelist_state");
      setData(next);
      setSaved(next);
      setNotice(
        submit
          ? "Prelista enviada a revisión. Recibirás aquí la aprobación o los motivos del rechazo."
          : "Prelista guardada. No se ha ejecutado ningún fichaje ni baja.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo guardar. Tus cambios siguen aquí.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <SectionCard title="Mi prelista del draft" icon={ClipboardList}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Privada para tu presidencia. Planificar no compra, reserva ni vende
          jugadores.
        </p>
        {error && (
          <p role="alert" className="rounded border border-destructive p-3">
            {error}
          </p>
        )}
        {!data ? (
          error ? (
            <Button variant="outline" onClick={() => setAttempt((v) => v + 1)}>
              Reintentar prelista
            </Button>
          ) : (
            <p role="status">Cargando prelista…</p>
          )
        ) : (
          <>
            <p>
              Altas: {data.entries.length}/{data.limit} · Bajas:{" "}
              {data.outgoing.length}/{data.limit}
            </p>
            <p role="status">
              {data.status === "submitted"
                ? "En revisión: espera la respuesta del administrador o designado."
                : data.status === "reviewed"
                  ? "Revisión recibida: consulta el resultado de cada jugador. Modifica los rechazados y vuelve a enviar."
                  : "Borrador: guarda y envía tu prelista para revisión."}
            </p>
            <fieldset
              disabled={busy || data.status === "submitted"}
              className="space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1">
                  Tipo de jugador
                  <select
                    className={selectClass}
                    value={kind}
                    onChange={(e) => {
                      setKind(e.target.value as "owned" | "new");
                      resetForm();
                    }}
                  >
                    <option value="owned">De otro presidente</option>
                    <option value="new">Jugador nuevo</option>
                  </select>
                </label>
                {kind === "owned" ? (
                  <>
                    <label className="space-y-1">
                      Equipo vendedor
                      <select
                        className={selectClass}
                        value={clubId}
                        onChange={(e) => {
                          setClubId(e.target.value);
                          setPlayerId("");
                          setSofifaUrl("");
                        }}
                      >
                        <option value="">Selecciona un equipo</option>
                        {data.clubs.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      Jugador a comprar
                      <select
                        className={selectClass}
                        disabled={!clubId}
                        value={playerId}
                        onChange={(e) => {
                          setPlayerId(e.target.value);
                          setSofifaUrl("");
                        }}
                      >
                        <option value="">Selecciona un jugador</option>
                        {data.players
                          .filter((p) => p.clubId === clubId)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      Enlace actual de SoFIFA
                      <Input
                        type="url"
                        value={sofifaUrl}
                        onChange={(e) => setSofifaUrl(e.target.value)}
                        placeholder="https://sofifa.com/player/…"
                      />
                    </label>
                    {player && (
                      <p className="rounded border p-3 md:col-span-2">
                        Datos de la BD:{" "}
                        {player.nationality || "Nacionalidad no registrada"} ·{" "}
                        {player.position} · Media {player.ovr}
                      </p>
                    )}
                    {data.clubs.length === 0 && (
                      <p>
                        Aún no hay otros equipos con presidente para
                        seleccionar.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <label className="space-y-1">
                      Nombre y apellido
                      <Input
                        value={name}
                        maxLength={150}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                    <label className="space-y-1">
                      Valoración media
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        step={1}
                        value={ovr}
                        onChange={(e) => setOvr(e.target.value)}
                      />
                    </label>
                    <label className="space-y-1">
                      Nacionalidad
                      <Input
                        value={nationality}
                        maxLength={80}
                        onChange={(e) => setNationality(e.target.value)}
                      />
                    </label>
                    <fieldset className="space-y-2 md:col-span-2">
                      <legend>Posiciones del jugador</legend>
                      <div className="flex flex-wrap gap-3">
                        {DRAFT_POSITIONS.map((p) => (
                          <label key={p} className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={positions.includes(p)}
                              onChange={(e) =>
                                setPositions(
                                  e.target.checked
                                    ? [...positions, p]
                                    : positions.filter((v) => v !== p),
                                )
                              }
                            />
                            {p}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <p className="text-sm text-muted-foreground md:col-span-2">
                      Datos propuestos por el presidente, pendientes de
                      revisión. No se añade al catálogo oficial.
                    </p>
                  </>
                )}
                <label className="space-y-1">
                  Precio de adquisición (€)
                  <Input
                    type="number"
                    min="0.01"
                    max="2000000000"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </label>
              </div>
              <Button
                type="button"
                disabled={!editingId && data.entries.length >= data.limit}
                onClick={add}
              >
                {editingId ? "Actualizar selección" : "Añadir a la prelista"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar edición de selección
                </Button>
              )}
              <ul className="space-y-2" aria-label="Altas preseleccionadas">
                {data.entries.map((entry, index) => {
                  const existing =
                    entry.kind === "owned"
                      ? data.players.find((p) => p.id === entry.playerId)
                      : null;
                  return (
                    <li
                      key={entry.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
                    >
                      <div>
                        {index + 1}.{" "}
                        {entry.kind === "new"
                          ? entry.name
                          : (existing?.name ??
                            "Jugador ya no disponible: elimina o revisa esta selección")}{" "}
                        · {formatMoney(entry.price)}
                        <p className="text-sm text-muted-foreground">
                          {entry.kind === "new"
                            ? `${entry.nationality} · ${entry.positions.join(" / ")} · Media ${entry.ovr} · Datos propuestos`
                            : existing
                              ? `${existing.nationality} · ${existing.position} · Media ${existing.ovr}`
                              : "La propiedad del jugador ha cambiado"}
                        </p>
                        {entry.kind === "owned" && (
                          <a
                            className="text-sm underline"
                            href={entry.sofifaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Ficha en SoFIFA
                          </a>
                        )}
                        <p className="text-sm font-semibold">
                          {entry.reviewStatus === "approved"
                            ? "Aprobada"
                            : entry.reviewStatus === "rejected"
                              ? "Rechazada"
                              : "Pendiente de aprobación"}
                          {entry.reviewNote ? `: ${entry.reviewNote}` : ""}
                        </p>
                      </div>
                      {entry.reviewStatus !== "approved" && (
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() => {
                            resetForm();
                            setEditingId(entry.id);
                            setKind(entry.kind);
                            setPrice(String(entry.price));
                            if (entry.kind === "owned") {
                              setClubId(entry.clubId);
                              setPlayerId(entry.playerId);
                              setSofifaUrl(entry.sofifaUrl);
                            } else {
                              setName(entry.name);
                              setOvr(String(entry.ovr));
                              setNationality(entry.nationality);
                              setPositions(entry.positions);
                            }
                          }}
                        >
                          Modificar selección {index + 1}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        type="button"
                        aria-label={`Quitar alta ${index + 1}`}
                        onClick={() => {
                          setData({
                            ...data,
                            entries: data.entries.filter((_, i) => i !== index),
                          });
                          setNotice("");
                        }}
                      >
                        Quitar
                      </Button>
                    </li>
                  );
                })}
              </ul>
              <fieldset className="space-y-2">
                <legend>
                  Bajas previstas de mi plantilla (opcional al preparar la
                  lista)
                </legend>
                {data.ownPlayers.map((p) => (
                  <label key={p.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={data.outgoing.includes(p.id)}
                      disabled={
                        !data.outgoing.includes(p.id) &&
                        data.outgoing.length >= data.limit
                      }
                      onChange={(e) => {
                        setData({
                          ...data,
                          outgoing: e.target.checked
                            ? [...data.outgoing, p.id]
                            : data.outgoing.filter((id) => id !== p.id),
                        });
                        setNotice("");
                      }}
                    />
                    {p.name}
                  </label>
                ))}
              </fieldset>
              <div className="flex gap-3">
                <Button
                  type="button"
                  disabled={!dirty || Boolean(editingId)}
                  onClick={() => void save()}
                >
                  {busy ? "Guardando…" : "Guardar prelista"}
                </Button>
                <Button
                  type="button"
                  disabled={
                    !data.entries.some((e) => e.reviewStatus === "pending") ||
                    data.entries.some((e) => e.reviewStatus === "rejected") ||
                    Boolean(editingId)
                  }
                  onClick={() => void save(true)}
                >
                  Enviar a revisión
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!dirty}
                  onClick={() => {
                    setData(saved);
                    setError("");
                    setNotice("");
                    resetForm();
                  }}
                >
                  Cancelar cambios
                </Button>
              </div>
            </fieldset>
          </>
        )}
        {notice && <p role="status">{notice}</p>}
        {data?.canReview && <DraftReviews />}
      </div>
    </SectionCard>
  );
}
