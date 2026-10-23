import { Link } from "react-router";
import { MessageCircle } from "lucide-react";
import { useChatInbox } from "@/hooks/use-chat";

/** Failure here must never interrupt dashboard navigation. Mount per user/Universe. */
export function ChatNotificationLink({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const { inbox } = useChatInbox(tournamentId);
  return (
    <Link
      to="/dashboard/chat"
      className="mb-4 flex min-h-11 items-center gap-2 rounded-lg border bg-card p-3 text-sm font-semibold"
    >
      <MessageCircle className="size-4" aria-hidden="true" />
      Chat interno
      <span
        aria-live="polite"
        className="ml-auto text-xs text-muted-foreground"
      >
        {inbox ? `${inbox.unread} sin leer` : "Abrir conversaciones"}
      </span>
    </Link>
  );
}
