import { useEffect, useId, useRef, useState } from "react";
import { Tv, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BROADCAST_CHANNEL,
  BROADCAST_MIN_WIDTH,
  BROADCAST_RECORDINGS,
  youtubeEmbedUrl,
} from "@/domain/broadcast";

/** Watching a video never reports a score or modifies a league. */
export function Broadcast() {
  const container = useRef<HTMLDivElement>(null);
  const playerId = useId(),
    selectId = useId();
  const [width, setWidth] = useState<number | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const [selection, setSelection] = useState("live");
  const [second, setSecond] = useState(0);
  const [opened, setOpened] = useState(true),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const measure = () => setWidth(node.getBoundingClientRect().width);
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      return () => observer.disconnect();
    }
    const frame = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, []);
  useEffect(() => {
    const openEvidence = (event: Event) => {
      const detail = (event as CustomEvent<{ videoId: string; second: number }>)
        .detail;
      if (
        !detail ||
        detail.videoId === "live" ||
        !youtubeEmbedUrl(detail.videoId, origin, detail.second)
      )
        return;
      setSelection(detail.videoId);
      setSecond(detail.second);
      setFailed(false);
      setOpened(true);
    };
    window.addEventListener("eleven:broadcast-video", openEvidence);
    return () =>
      window.removeEventListener("eleven:broadcast-video", openEvidence);
  }, [origin]);
  const source = youtubeEmbedUrl(selection, origin, second);
  const narrow = width !== null && width < BROADCAST_MIN_WIDTH;
  const playable = source !== null && width !== null && !narrow;
  return (
    <section
      id="transmision"
      className="card-soft flex min-w-0 flex-col overflow-hidden"
      aria-label="Transmisión de Super Nova League"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="display flex items-center gap-2 text-[13px] font-bold">
          <Tv className="size-4 text-primary" aria-hidden="true" />
          Transmisión · Super Nova League
        </h2>
        <span className="text-xs text-muted-foreground">
          YouTube · @{BROADCAST_CHANNEL}
        </span>
      </header>
      <div className="min-w-0 p-4">
        <label htmlFor={selectId} className="mb-1 block text-sm font-semibold">
          Seleccionar transmisión o grabación
        </label>
        <select
          id={selectId}
          className="mb-3 min-h-11 w-full rounded-md border bg-background py-2 pl-3 pr-10 text-sm"
          value={selection}
          onChange={(event) => {
            setSelection(event.target.value);
            setSecond(0);
            setFailed(false);
            setOpened(true);
          }}
        >
          <option value="live">Directo del canal (si está disponible)</option>
          {BROADCAST_RECORDINGS.map((video) => (
            <option key={video.id} value={video.id}>
              {video.title} · {video.duration}
            </option>
          ))}
        </select>
        <p className="mb-3 text-sm text-muted-foreground">
          {selection === "live"
            ? "Si no hay un directo disponible, selecciona una grabación para verla aquí."
            : "Estás viendo una grabación, no una transmisión en directo."}
        </p>
        {narrow ? (
          <p
            role="status"
            className="rounded-lg border bg-muted/40 p-4 text-sm"
          >
            Amplía el reproductor a un mínimo de 200 px para verlo dentro de la
            app.
          </p>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={!playable}
            aria-expanded={opened}
            aria-controls={playerId}
            onClick={() => {
              setOpened(!opened);
              setFailed(false);
            }}
          >
            {opened ? (
              <X className="size-4" aria-hidden="true" />
            ) : (
              <Tv className="size-4" aria-hidden="true" />
            )}
            {opened ? "Cerrar reproductor" : "Ver transmisión"}
          </Button>
        )}
        {opened && !narrow && !failed ? (
          <aside
            role="note"
            aria-label="Ayuda para reproducir la transmisión"
            className="mt-3 rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm"
          >
            <p className="font-semibold">
              ¿El video no se inicia automáticamente?
            </p>
            <p className="mt-1 text-muted-foreground">
              Pulsa Reproducir (▶) dentro del video, sin salir de 11Eleven. El
              inicio se solicita sin sonido; actívalo en sus controles. Si la
              emisión no está disponible o no permite reproducción integrada,
              selecciona otra grabación.
            </p>
          </aside>
        ) : null}
        <div id={playerId} className="mt-3" ref={container}>
          {opened && playable && !failed ? (
            <iframe
              key={`${selection}:${second}`}
              title="YouTube · Super Nova League"
              src={source}
              width="100%"
              height="420"
              className="min-h-[240px] w-full rounded-lg border bg-black"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              onError={() => setFailed(true)}
            />
          ) : null}
          {failed ? (
            <p
              role="alert"
              className="rounded-lg border border-amber-500/40 p-3 text-sm"
            >
              No se pudo cargar el reproductor. Ciérralo y vuelve a abrirlo aquí
              o selecciona otra grabación.
            </p>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          El reproductor conecta con YouTube sin redirigirte. Ver un video no
          modifica los resultados del torneo. El catálogo de grabaciones se
          revisó el 6 de noviembre de 2026.
        </p>
      </div>
    </section>
  );
}
