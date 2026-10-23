import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router";
import { Bot, Send } from "lucide-react";
import type { ChatHistory, ChatMessage, ChatSelection } from "@/domain/chat";
import { validateChatBody } from "@/domain/chat";
import { chatBackend } from "@/services/backend/chat";
import { refreshChat, useChatConversation } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

export function ChatMessages({
  messages,
  presidentId,
}: {
  messages: ChatMessage[];
  presidentId: string;
}) {
  return (
    <ol className="space-y-3" aria-label="Mensajes de la conversación">
      {messages.map((m) => (
        <li
          key={m.id}
          className={`max-w-[95%] rounded-xl border p-3 sm:max-w-[85%] ${m.sender === "bot" ? "border-primary/20 bg-primary/5" : m.authorId === presidentId ? "ml-auto bg-secondary" : "bg-card"}`}
        >
          <div className="mb-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            {m.sender === "bot" && (
              <Bot className="size-4" aria-hidden="true" />
            )}
            <strong className="text-foreground">{m.authorName}</strong>
            <time dateTime={m.createdAt}>
              {new Date(m.createdAt).toLocaleString("es-CO")}
            </time>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">
            {m.body}
          </p>
          {m.metadata?.event === "fixture" && m.metadata.kickoffAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Horario local:{" "}
              {new Date(m.metadata.kickoffAt).toLocaleString("es-CO")}
            </p>
          )}
          {m.metadata?.event === "offer" && (
            <Link
              className="mt-2 inline-block text-sm underline"
              to="/dashboard/mercado/negociaciones"
            >
              Ver negociación
            </Link>
          )}
          {(m.metadata?.event === "fixture" ||
            m.metadata?.event === "result") && (
            <Link
              className="mt-2 inline-block text-sm underline"
              to="/dashboard/competicion"
            >
              Ver partido y resultados
            </Link>
          )}
        </li>
      ))}
    </ol>
  );
}
export function ChatRoomView({
  title,
  history,
  presidentId,
  loading,
  error,
  children,
}: {
  title: string;
  history: ChatHistory;
  presidentId: string;
  loading: boolean;
  error: string;
  children?: ReactNode;
}) {
  const scroll = useRef<HTMLDivElement | null>(null);
  const following = useRef(true);
  const lastId = history.messages[history.messages.length - 1]?.id;
  useEffect(() => {
    const element = scroll.current;
    if (element && following.current) element.scrollTop = element.scrollHeight;
  }, [lastId]);
  return (
    <section
      className="min-w-0 rounded-xl border bg-card p-4"
      aria-label={title}
    >
      <h2 className="display text-xl">{title}</h2>
      {history.offer && (
        <p className="mt-2 rounded border p-2 text-sm">
          Oferta {history.offer.status} ·{" "}
          {new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "EUR",
          }).format(history.offer.cash)}{" "}
          de efectivo total.{" "}
          <Link className="underline" to="/dashboard/mercado/negociaciones">
            Gestionar oferta
          </Link>
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="my-3 rounded border border-destructive/40 p-3 text-sm"
        >
          {error} Puedes reintentar o seguir navegando. Tu sesión no se cerrará.
        </p>
      )}
      {loading ? (
        <p role="status" className="py-8">
          Cargando conversación…
        </p>
      ) : !history.messages.length && !error ? (
        <p className="py-8 text-muted-foreground">
          Todavía no hay mensajes en esta conversación.
        </p>
      ) : null}
      <div
        ref={scroll}
        onScroll={() => {
          const e = scroll.current;
          if (e)
            following.current =
              e.scrollHeight - e.scrollTop - e.clientHeight < 80;
        }}
        className="my-4 max-h-[55vh] overflow-y-auto rounded p-1"
        tabIndex={0}
        aria-label="Historial del chat"
      >
        <ChatMessages messages={history.messages} presidentId={presidentId} />
      </div>
      {children}
    </section>
  );
}
export function ChatRoom({
  selection,
  title,
  presidentId,
  tournamentId,
}: {
  selection: ChatSelection;
  title: string;
  presidentId: string;
  tournamentId: string;
}) {
  const { history, error, loading, loadingOlder, loadOlder, reload } =
    useChatConversation(selection, tournamentId);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [readError, setReadError] = useState("");
  const attempt = useRef<{ body: string; id: string } | null>(null);
  const lastRead = useRef<string | null>(null);
  const latest = history.messages[history.messages.length - 1]?.id;
  useEffect(() => {
    // Reading requires the actual conversation to be foregrounded, never the inbox badge.
    let active = true;
    const mark = async () => {
      if (document.hidden || !latest || lastRead.current === latest) return;
      try {
        await chatBackend.read(selection, latest, tournamentId);
        if (!active) return;
        lastRead.current = latest;
        setReadError("");
        refreshChat();
      } catch (e) {
        if (active) setReadError(errorMessage(e));
      }
    };
    void mark();
    window.addEventListener("focus", mark);
    document.addEventListener("visibilitychange", mark);
    return () => {
      active = false;
      window.removeEventListener("focus", mark);
      document.removeEventListener("visibilitychange", mark);
    };
  }, [latest, selection, tournamentId]);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    try {
      const value = validateChatBody(body);
      if (attempt.current?.body !== value)
        attempt.current = { body: value, id: crypto.randomUUID() };
      setSending(true);
      setSendError("");
      await chatBackend.send(
        selection,
        value,
        attempt.current.id,
        tournamentId,
      );
      setBody("");
      attempt.current = null;
      refreshChat();
      await reload();
    } catch (cause) {
      setSendError(errorMessage(cause));
    } finally {
      setSending(false);
    }
  };
  return (
    <ChatRoomView
      title={title}
      history={history}
      presidentId={presidentId}
      loading={loading}
      error={error}
    >
      {history.hasMore && (
        <Button
          variant="outline"
          className="mb-3"
          onClick={() => void loadOlder()}
          disabled={loadingOlder}
        >
          {loadingOlder ? "Cargando anteriores…" : "Cargar mensajes anteriores"}
        </Button>
      )}
      {selection.kind === "bot" ? (
        <p className="text-sm text-muted-foreground">
          Buzón privado. El bot publica partidos programados y resultados/goles
          cuando se registran en la aplicación. No es una retransmisión en vivo
          de EA FC.
        </p>
      ) : (
        <form
          onSubmit={(e) => void send(e)}
          className="space-y-2 border-t pt-3"
        >
          <label htmlFor="chat-body" className="text-sm font-semibold">
            Mensaje
          </label>
          <textarea
            id="chat-body"
            rows={3}
            maxLength={4000}
            value={body}
            disabled={sending || loading || !!error}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded-lg border bg-background p-3"
            placeholder="Escribe a los presidentes…"
            aria-describedby="chat-limit"
          />
          <div className="flex items-center justify-between gap-3">
            <span id="chat-limit" className="text-xs text-muted-foreground">
              {[...body].length}/2000 · Texto sin archivos adjuntos
            </span>
            <Button
              type="submit"
              disabled={
                sending ||
                loading ||
                !!error ||
                !body.trim() ||
                [...body].length > 2000
              }
            >
              <Send className="mr-2 size-4" aria-hidden="true" />
              {sending ? "Enviando…" : "Enviar"}
            </Button>
          </div>
        </form>
      )}
      {(sendError || readError) && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {sendError || `No se pudo actualizar la lectura: ${readError}`}
        </p>
      )}
      {error && (
        <Button variant="outline" onClick={() => void reload()}>
          Reintentar
        </Button>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        La conversación se actualiza cada 5 segundos mientras la pestaña está
        visible.
      </p>
    </ChatRoomView>
  );
}
