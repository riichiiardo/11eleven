import { useEffect, useState } from "react";
import { rpc, supabase } from "@/infrastructure/supabase/client";
import { parsePoolCsv, type PoolImportRow } from "@/domain/player-pool";
import { SectionCard } from "@/components/eleven/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Database } from "lucide-react";

type Player = {
  id: string;
  name: string;
  nationality: string;
  age: number;
  position: string;
  sofifa_id?: number;
};
type Status = {
  active: number;
  identified: number;
  pending: Player[];
  candidates: Player[];
};
type ImageStatus = {
  pending: number;
  processing: number;
  ready: number;
  error: number;
  lastError: string | null;
};
type ImageResult = {
  ready: number;
  errors: number;
  blocked: boolean;
  lastError: string | null;
  ok?: boolean;
  error?: string;
};
type ImportSummary = { total: number; inserted: number; updated: number };
export function CatalogPanel() {
  const [images, setImages] = useState<ImageStatus | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageNotice, setImageNotice] = useState("");
  const [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [rows, setRows] = useState<PoolImportRow[]>([]),
    [filename, setFilename] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState("");
  const [preserve, setPreserve] = useState(""),
    [source, setSource] = useState(""),
    [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState(false),
    [manualConfirm, setManualConfirm] = useState(false),
    [candidates, setCandidates] = useState<Player[]>([]);
  const reload = async () => {
    const next = await rpc<Status>("pool_status");
    setStatus(next);
    setImages(await rpc<ImageStatus>("player_images_status"));
  };
  useEffect(() => {
    let active = true;
    Promise.all([
      rpc<Status>("pool_status"),
      rpc<ImageStatus>("player_images_status"),
    ])
      .then(([next, nextImages]) => {
        if (active) setImages(nextImages);
        if (active) setStatus(next);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const fail = (e: unknown) =>
    setError(e instanceof Error ? e.message : String(e));
  const upload = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const job = await rpc<string>("pool_import_start", {
        p_expected: rows.length,
        p_label: filename,
      });
      for (let offset = 0; offset < rows.length; offset += 500) {
        setProgress(
          `Cargando ${Math.min(offset + 500, rows.length)} de ${rows.length}`,
        );
        const args = {
          p_job: job,
          p_offset: offset,
          p_rows: rows.slice(offset, offset + 500),
        };
        try {
          await rpc("pool_import_batch", args);
        } catch {
          await rpc("pool_import_batch", args);
        }
      }
      setProgress("Aplicando actualización del pool…");
      let summary: ImportSummary;
      try {
        summary = await rpc<ImportSummary>("pool_import_finish", {
          p_job: job,
        });
      } catch {
        summary = await rpc<ImportSummary>("pool_import_finish", {
          p_job: job,
        });
      }
      setMessage(
        `${summary.total} jugadores activos · ${summary.updated} actualizados · ${summary.inserted} nuevos.`,
      );
      setRows([]);
      setConfirm(false);
      await reload();
      if (rows.some((row) => row.imageUrl)) await processImages();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
      setProgress("");
    }
  };
  const processImages = async () => {
    setImageBusy(true);
    setError("");
    setImageNotice("");
    try {
      await rpc("player_images_retry");
      while (true) {
        const current = await rpc<ImageStatus>("player_images_status");
        setImages(current);
        if (!current.pending) break;
        setImageNotice(
          `${current.ready} rostros guardados · ${current.pending} pendientes`,
        );
        const result = await supabase.functions.invoke<ImageResult>(
          "player-portraits",
          { body: {} },
        );
        if (result.error || result.data?.error)
          throw Error(
            result.data?.error ?? result.error?.message ?? "Error de imágenes.",
          );
        if (result.data?.blocked) {
          setImageNotice(
            result.data.lastError ??
              "El origen bloqueó la descarga. Puedes reintentar más tarde.",
          );
          break;
        }
        if (!result.data || (!result.data.ready && !result.data.errors)) break;
      }
      setImages(await rpc<ImageStatus>("player_images_status"));
    } catch (e) {
      fail(e);
    } finally {
      setImageBusy(false);
    }
  };
  const probeImage = async () => {
    const sample = rows.find((row) => row.imageUrl);
    if (!sample) return;
    setImageBusy(true);
    setError("");
    try {
      const result = await supabase.functions.invoke<ImageResult>(
        "player-portraits",
        {
          body: { probe: { url: sample.imageUrl, sofifaId: sample.sourceId } },
        },
      );
      if (result.error) throw result.error;
      setImageNotice(
        result.data?.ok
          ? "El servidor puede descargar la foto. Listo para importar."
          : (result.data?.error ?? "No se pudo descargar la foto."),
      );
    } catch (e) {
      fail(e);
    } finally {
      setImageBusy(false);
    }
  };
  const find = async () => {
    setBusy(true);
    setError("");
    try {
      setCandidates(
        (await rpc<Status>("pool_status", { p_search: search })).candidates,
      );
      setSource("");
      setManualConfirm(false);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const reconcile = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await rpc("pool_reconcile", { p_preserve: preserve, p_source: source });
      setMessage(
        "Ficha vinculada. El jugador conserva su asignación y su ID interno.",
      );
      setPreserve("");
      setSource("");
      setManualConfirm(false);
      setCandidates([]);
      await reload();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <SectionCard title="Pool de jugadores" icon={Database}>
      <div className="space-y-6">
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="rounded-lg border p-3 text-sm">
            {message}
          </p>
        )}
        {!status && !error ? (
          <p>Cargando pool…</p>
        ) : (
          status && (
            <p>
              {status.active} jugadores activos · {status.identified} con ID de
              SoFIFA · {status.pending.length} asignados pendientes de
              conciliación.
            </p>
          )
        )}
        <div className="space-y-3 rounded-xl border p-4">
          <h3 className="font-semibold">Actualizar desde CSV</h3>
          <p className="text-sm text-muted-foreground">
            Carga el pool completo con la columna ID de SoFIFA. La actualización
            conserva los identificadores internos y las asignaciones de los
            jugadores identificados. Los ausentes quedan inactivos y los
            asignados siguen disponibles en sus equipos.
          </p>
          <label className="block text-sm">
            Archivo del pool
            <Input
              type="file"
              accept=".csv,text/csv"
              disabled={busy || imageBusy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                setRows([]);
                setError("");
                setConfirm(false);
                if (!file) return;
                try {
                  if (file.size > 15000000)
                    throw Error("El archivo supera 15 MB.");
                  setRows(parsePoolCsv(await file.text()));
                  setFilename(file.name);
                } catch (e) {
                  fail(e);
                }
              }}
            />
          </label>
          {rows.length > 0 && (
            <p>
              {rows.length} jugadores validados en {filename}.
            </p>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirm}
              disabled={busy || imageBusy}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            Confirmo que este archivo contiene el pool completo a activar.
          </label>
          <Button
            disabled={busy || imageBusy || !rows.length || !confirm}
            onClick={upload}
          >
            {busy ? progress || "Procesando…" : "Actualizar pool completo"}
          </Button>
        </div>
        <div className="space-y-3 rounded-xl border p-4">
          <h3 className="font-semibold">Rostros de jugadores</h3>
          <p className="text-sm text-muted-foreground">
            La columna opcional Imagen_URL se descarga a Supabase. Se intenta
            240 px y se conserva 120 px si no existe. Las fotos faltantes
            mantienen las iniciales; una descarga fallida no borra una foto
            guardada.
          </p>
          {images && (
            <p>
              {images.ready} guardados · {images.pending} pendientes ·{" "}
              {images.processing} en proceso · {images.error} con error
            </p>
          )}
          {imageNotice && (
            <p role="status" className="rounded-lg border p-3 text-sm">
              {imageNotice}
            </p>
          )}
          {images?.lastError && (
            <p className="text-sm text-destructive">{images.lastError}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={probeImage}
              disabled={busy || imageBusy || !rows.some((row) => row.imageUrl)}
            >
              Probar una foto del archivo
            </Button>
            <Button
              variant="outline"
              onClick={processImages}
              disabled={
                busy ||
                imageBusy ||
                !images ||
                !(images.pending + images.error + images.processing)
              }
            >
              {imageBusy
                ? "Procesando rostros…"
                : "Descargar / reintentar rostros"}
            </Button>
          </div>
        </div>
        <div className="space-y-3 rounded-xl border p-4">
          <h3 className="font-semibold">Conciliar un jugador de un equipo</h3>
          <p className="text-sm text-muted-foreground">
            Selecciona una ficha pendiente y busca su ficha actual en el pool.
            La vinculación conserva el jugador del equipo y actualiza sus datos
            desde la ficha seleccionada.
          </p>
          <label className="block text-sm">
            Jugador pendiente
            <select
              aria-label="Jugador pendiente"
              className="mt-1 min-h-11 w-full rounded-md border bg-background px-3 pr-10"
              disabled={busy || imageBusy}
              value={preserve}
              onChange={(e) => {
                setPreserve(e.target.value);
                setManualConfirm(false);
              }}
            >
              <option value="">Seleccionar jugador</option>
              {status?.pending.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.nationality} · {p.age} años · {p.position}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <Input
              aria-label="Buscar jugador del pool"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre del jugador"
            />
            <Button disabled={busy || search.trim().length < 2} onClick={find}>
              Buscar
            </Button>
          </div>
          <label className="block text-sm">
            Ficha correcta del pool
            <select
              aria-label="Ficha correcta del pool"
              className="mt-1 min-h-11 w-full rounded-md border bg-background px-3 pr-10"
              disabled={busy || imageBusy}
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setManualConfirm(false);
              }}
            >
              <option value="">Seleccionar ficha</option>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.nationality} · {p.age} años · {p.position} ·
                  SoFIFA {p.sofifa_id ?? "pendiente"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={manualConfirm}
              disabled={busy || imageBusy}
              onChange={(e) => setManualConfirm(e.target.checked)}
            />
            Confirmo que ambas fichas corresponden al mismo jugador.
          </label>
          <Button
            disabled={
              busy || imageBusy || !preserve || !source || !manualConfirm
            }
            onClick={reconcile}
          >
            Vincular ficha al jugador del equipo
          </Button>
          <p className="text-xs text-muted-foreground">
            Las coincidencias ambiguas requieren revisión. Si el CSV presenta
            homónimos, puedes añadir ID Pool para indicar expresamente el
            identificador interno.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
