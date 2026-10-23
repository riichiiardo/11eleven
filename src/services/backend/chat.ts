import { rpc } from "@/infrastructure/supabase/client";
import type { ChatHistory, ChatInbox, ChatSelection } from "@/domain/chat";
import { validateChatBody } from "@/domain/chat";

const params = (s: ChatSelection) => ({ p_kind: s.kind, p_target: s.targetId });
export const chatBackend = {
  inbox: async (tournamentId: string) => {
    const data = await rpc<ChatInbox>("chat_inbox", {
      p_tournament_id: tournamentId,
    });
    if (
      !data ||
      !Array.isArray(data.threads) ||
      !Array.isArray(data.contacts) ||
      typeof data.unread !== "number"
    )
      throw new Error("La bandeja del chat no tiene un formato válido.");
    return data;
  },
  history: async (
    s: ChatSelection,
    before: string | null = null,
    after: string | null = null,
    tournamentId: string,
  ) => {
    const data = await rpc<ChatHistory>("chat_history", {
      ...params(s),
      p_before: before,
      p_after: after,
      p_tournament_id: tournamentId,
    });
    if (
      !data ||
      !Array.isArray(data.messages) ||
      typeof data.hasMore !== "boolean"
    )
      throw new Error("No se pudo leer la conversación.");
    return data;
  },
  send: (
    s: ChatSelection,
    body: string,
    clientId: string,
    tournamentId: string,
  ) =>
    rpc<string>("chat_send", {
      ...params(s),
      p_body: validateChatBody(body),
      p_client_id: clientId,
      p_tournament_id: tournamentId,
    }),
  read: (s: ChatSelection, id: string, tournamentId: string) =>
    rpc("chat_mark_read", {
      ...params(s),
      p_message_id: id,
      p_tournament_id: tournamentId,
    }),
};
