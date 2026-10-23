import { useNavigate, useSearchParams } from "react-router";
import { Link } from "react-router";
import { MessageCircle } from "lucide-react";
import { chatSelection, chatUrl, type ChatSelection } from "@/domain/chat";
import { useChatInbox, refreshChat } from "@/hooks/use-chat";
import { ChatRoom } from "@/components/eleven/ChatRoom";
import { Button } from "@/components/ui/button";
import { useDashboardState } from "./dashboard-context";

export default function ChatPage() {
  const state = useDashboardState();
  if (!state?.president || !state.tournament)
    return <p role="status">Selecciona tu club para usar el chat.</p>;
  return (
    <ChatInboxPage
      key={`${state.user.id}:${state.tournament.id}`}
      tournamentId={state.tournament.id}
    />
  );
}
function ChatInboxPage({ tournamentId }: { tournamentId: string }) {
  const navigate = useNavigate();
  const { inbox, error, loading } = useChatInbox(tournamentId);
  const [params] = useSearchParams();
  const selected = chatSelection(params);
  const same = (s: ChatSelection) =>
    s.kind === selected.kind && s.targetId === selected.targetId;
  const title =
    inbox?.threads.find(same)?.title ??
    (selected.kind === "bot"
      ? "Bot 11Eleven"
      : selected.kind === "offer"
        ? "Negociación por jugador"
        : selected.kind === "direct"
          ? (inbox?.contacts.find((c) => c.id === selected.targetId)?.name ??
            "Conversación privada")
          : "Sala general");
  const roomLink = (s: ChatSelection, label: string, unread = 0) => (
    <Link
      to={chatUrl(s)}
      aria-current={same(s) ? "page" : undefined}
      className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border p-3 text-sm ${same(s) ? "border-primary bg-primary/10 font-semibold" : "bg-card hover:bg-accent"}`}
    >
      {label}
      {unread > 0 && (
        <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
          {unread} sin leer
        </span>
      )}
    </Link>
  );
  return (
    <div className="space-y-4">
      <header>
        <h1 className="display flex items-center gap-2 text-2xl">
          <MessageCircle aria-hidden="true" />
          Chat interno
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conversación casual, negociaciones y avisos privados de tu equipo.
          Solo tu Universo.
        </p>
      </header>
      {error && (
        <div
          role="alert"
          className="rounded border border-destructive/40 p-3 text-sm"
        >
          No se pudo cargar la bandeja: {error}{" "}
          <Button variant="outline" onClick={refreshChat}>
            Reintentar
          </Button>
        </div>
      )}
      {loading && <p role="status">Cargando bandeja…</p>}
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4" aria-label="Conversaciones">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Conversación casual</h2>
            {roomLink(
              { kind: "general", targetId: null },
              "Sala general",
              inbox?.threads.find((t) => t.kind === "general")?.unread,
            )}
            <label
              htmlFor="chat-contact"
              className="block text-xs text-muted-foreground"
            >
              Hablar en privado con un presidente
            </label>
            <select
              id="chat-contact"
              className="min-h-11 w-full rounded-lg border bg-background py-2 pl-3 pr-10"
              value={
                selected.kind === "direct" ? (selected.targetId ?? "") : ""
              }
              onChange={(e) => {
                if (e.target.value)
                  navigate(
                    chatUrl({ kind: "direct", targetId: e.target.value }),
                  );
              }}
            >
              <option value="">Seleccionar presidente</option>
              {inbox?.contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.club} · {c.name}
                </option>
              ))}
            </select>
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Avisos del equipo</h2>
            {roomLink(
              { kind: "bot", targetId: null },
              "Bot 11Eleven",
              inbox?.threads.find((t) => t.kind === "bot")?.unread,
            )}
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Conversaciones recientes</h2>
            {inbox?.threads
              .filter((t) => t.kind === "direct" || t.kind === "offer")
              .map((t) => (
                <div key={t.id}>
                  {roomLink(t, t.title, t.unread)}
                  <p className="truncate px-2 py-1 text-xs text-muted-foreground">
                    {t.preview}
                  </p>
                </div>
              ))}
            {!inbox?.threads.some(
              (t) => t.kind === "offer" || t.kind === "direct",
            ) && (
              <p className="text-sm text-muted-foreground">
                Las ofertas crearán aquí un hilo privado entre comprador y
                vendedor.
              </p>
            )}
          </section>
        </aside>
        <ChatRoom
          tournamentId={tournamentId}
          key={`${selected.kind}:${selected.targetId}`}
          selection={selected}
          title={title}
          presidentId={inbox?.presidentId ?? ""}
        />
      </div>
    </div>
  );
}
