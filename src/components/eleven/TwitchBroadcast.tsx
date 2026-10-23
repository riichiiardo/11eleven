import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink, Tv, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  TWITCH_CHANNEL,
  TWITCH_CHANNEL_URL,
  TWITCH_MIN_WIDTH,
  twitchEmbedUrl,
} from "@/domain/twitch";

/** Viewing only. A stream starting/ending must never report a match result. */
export function TwitchBroadcast() {
  const container = useRef<HTMLDivElement>(null);
  const playerId = useId();
  const [width, setWidth] = useState<number | null>(null);
  const hostname = typeof window === "undefined" ? "" : window.location.hostname;
  const [opened, setOpened] = useState(false);
  const [failed, setFailed] = useState(false);
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
  const source = twitchEmbedUrl(hostname);
  const narrow = width !== null && width < TWITCH_MIN_WIDTH;
  const playable = source !== null && width !== null && !narrow;
  return (
    <section
      className="card-soft flex min-w-0 flex-col overflow-hidden"
      aria-label="Transmisión de Superliga Nova"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="display flex items-center gap-2 text-[13px] font-bold">
          <Tv className="size-4 text-primary" aria-hidden="true" />
          Transmisión · Superliga Nova
        </h2>
        <a
          href={TWITCH_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-primary hover:underline"
        >
          Abrir en Twitch{" "}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </header>
      <div className="min-w-0 p-4">
        <p className="mb-3 text-sm text-muted-foreground">
          Sigue los partidos simulados en el canal {TWITCH_CHANNEL}. El canal
          puede estar fuera de línea.
        </p>
        {narrow ? (
          <p
            role="status"
            className="rounded-lg border bg-muted/40 p-4 text-sm"
          >
            El reproductor de Twitch necesita al menos 400 px de ancho. Amplía
            la ventana o usa «Abrir en Twitch» para ver la transmisión.
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
        <div id={playerId} className="mt-3" ref={container}>
          {opened && playable && !failed ? (
            <iframe
              title="Twitch · Superliga Nova"
              src={source}
              width="100%"
              height="420"
              className="min-h-[300px] w-full rounded-lg border bg-black"
              allow="fullscreen; picture-in-picture"
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
              No se pudo cargar el reproductor. Puedes abrir el canal
              directamente en Twitch.
            </p>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Al abrir el reproductor te conectas con Twitch. Si no reproduce por
          restricciones del navegador, utiliza el enlace al canal. El video no
          modifica por sí solo los resultados del torneo.
        </p>
      </div>
    </section>
  );
}
