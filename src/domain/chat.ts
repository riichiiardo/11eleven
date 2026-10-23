export type ChatKind = "general" | "direct" | "offer" | "bot";
export type ChatSelection = { kind: ChatKind; targetId: string | null };
export type ChatMessage = {
  id: string;
  authorId: string | null;
  authorName: string;
  sender: "president" | "bot";
  body: string;
  metadata: {
    event?: string;
    offerId?: string;
    fixtureId?: string;
    kickoffAt?: string;
  };
  createdAt: string;
};
export type ChatThread = ChatSelection & {
  id: string;
  title: string;
  preview: string;
  unread: number;
  updatedAt: string;
};
export type ChatInbox = {
  presidentId: string;
  unread: number;
  contacts: { id: string; name: string; club: string }[];
  threads: ChatThread[];
};
export type ChatHistory = {
  messages: ChatMessage[];
  hasMore: boolean;
  hasNewer?: boolean;
  offer: { id: string; status: string; cash: number } | null;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function chatSelection(params: URLSearchParams): ChatSelection {
  const kind = params.get("tipo");
  const target = params.get("destino");
  if ((kind === "direct" || kind === "offer") && target && UUID.test(target))
    return { kind, targetId: target };
  return { kind: kind === "bot" ? "bot" : "general", targetId: null };
}
export function chatUrl(selection: ChatSelection) {
  const query = new URLSearchParams({ tipo: selection.kind });
  if (selection.targetId) query.set("destino", selection.targetId);
  return `/dashboard/chat?${query}`;
}
export function mergeChatMessages(older: ChatMessage[], latest: ChatMessage[]) {
  const rows = new Map(
    [...older, ...latest].map((message) => [message.id, message]),
  );
  return [...rows.values()].sort((a, b) =>
    BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0,
  );
}
export function validateChatBody(body: string) {
  const value = body.trim();
  // PostgreSQL length counts Unicode code points, not UTF-16 code units.
  if (!value || [...value].length > 2000)
    throw new Error("Escribe un mensaje de 1 a 2000 caracteres.");
  return value;
}
