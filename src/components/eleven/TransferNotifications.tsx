import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { rpc } from "@/infrastructure/supabase/client";
import { Button } from "@/components/ui/button";
type Notice = {
  id: string;
  offerId: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  tab: "recibidas" | "enviadas" | "reservadas" | "historial";
};
type Inbox = { unread: number; items: Notice[] };
export function TransferNotifications() {
  const [inbox, setInbox] = useState<Inbox>({ unread: 0, items: [] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const latest = useRef<number | null>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const next = await rpc<Inbox>("transfer_notifications_state");
        if (!next || !Array.isArray(next.items))
          throw new Error("No se pudieron cargar las notificaciones.");
        if (!active) return;
        const newest = next.items.reduce<Notice | null>(
          (current, n) =>
            !current || Date.parse(n.createdAt) > Date.parse(current.createdAt)
              ? n
              : current,
          null,
        );
        const timestamp = newest ? Date.parse(newest.createdAt) : 0;
        if (
          latest.current !== null &&
          timestamp > latest.current &&
          newest?.readAt === null
        )
          toast.info("Novedad en las negociaciones", {
            description: newest.message,
          });
        latest.current = Math.max(timestamp, latest.current ?? 0);
        setInbox(next);
        setError("");
      } catch (e) {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron consultar las notificaciones.",
          );
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    window.addEventListener("eleven:departure-bids", load);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("eleven:departure-bids", load);
    };
  }, []);
  async function markRead() {
    setBusy(true);
    try {
      await rpc("read_transfer_notifications", {
        p_ids: inbox.items.filter((n) => !n.readAt).map((n) => n.id),
      });
      window.dispatchEvent(new Event("eleven:departure-bids"));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo marcar como leído.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="mb-4 rounded-lg border bg-card p-3">
      <summary className="cursor-pointer font-semibold">
        <span aria-live="polite">
          Notificaciones de mercado · {inbox.unread} sin leer
        </span>
      </summary>
      {error && (
        <p role="alert" className="mt-2 text-sm">
          {error} Se reintentará automáticamente.
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Avisos dentro de la app. Actualización cada 15 segundos; no se envían
        correos.
      </p>
      {inbox.unread > 0 && (
        <Button
          className="my-2"
          variant="outline"
          disabled={busy}
          onClick={() => void markRead()}
        >
          Marcar las visibles como leídas
        </Button>
      )}
      <ul className="mt-2 space-y-2">
        {inbox.items.map((n) => (
          <li key={n.id} className="rounded border p-2 text-sm">
            <span className={!n.readAt ? "font-semibold" : ""}>
              {n.message}
            </span>
            <p className="text-xs text-muted-foreground">
              {new Date(n.createdAt).toLocaleString("es-CO")}
            </p>
            <Link
              className="underline"
              to={`/dashboard/mercado/negociaciones?tab=${n.tab}#oferta-${n.offerId}`}
            >
              Ver negociación
            </Link>
          </li>
        ))}
      </ul>
      {!inbox.items.length && !error && (
        <p className="mt-2 text-sm">Sin novedades de tus bajas anunciadas.</p>
      )}
    </details>
  );
}
