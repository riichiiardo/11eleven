import assert from "node:assert/strict";
import { createServer } from "vite";
import React from "react";
import { renderToString } from "react-dom/server";
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { chatSelection, chatUrl, mergeChatMessages, validateChatBody } =
    await server.ssrLoadModule("/src/domain/chat.ts");
  const id = "00000000-0000-4000-8000-000000000001";
  assert.deepEqual(
    chatSelection(new URLSearchParams("tipo=offer&destino=evil")),
    { kind: "general", targetId: null },
  );
  assert.deepEqual(
    chatSelection(new URLSearchParams("tipo=bot&destino=" + id)),
    { kind: "bot", targetId: null },
  );
  for (const kind of ["offer", "direct"])
    assert.deepEqual(
      chatSelection(
        new URL(chatUrl({ kind, targetId: id }), "https://example.invalid")
          .searchParams,
      ),
      { kind, targetId: id },
    );
  assert.equal(validateChatBody(" hola "), "hola");
  assert.equal(validateChatBody("😀".repeat(2000)).length, 4000);
  assert.throws(() => validateChatBody(" "));
  assert.throws(() => validateChatBody("😀".repeat(2001)));
  const message = {
    id: "9007199254740993",
    authorId: id,
    authorName: "Presidente",
    sender: "president",
    body: "<img src=x onerror=alert(1)>",
    metadata: {},
    createdAt: "2026-10-22T19:00:00Z",
  };
  const next = { ...message, id: "9007199254740994" };
  assert.deepEqual(
    mergeChatMessages([next, message], [message]).map((m) => m.id),
    [message.id, next.id],
  );
  const { MemoryRouter } = await import("react-router");
  const { ChatRoom, ChatRoomView } = await server.ssrLoadModule(
    "/src/components/eleven/ChatRoom.tsx",
  );
  const render = (element) =>
    renderToString(React.createElement(MemoryRouter, null, element));
  let html = render(
    React.createElement(ChatRoomView, {
      title: "General",
      presidentId: id,
      history: { messages: [message], hasMore: false, offer: null },
      loading: false,
      error: "",
    }),
  );
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img src=x"));
  html = render(
    React.createElement(ChatRoomView, {
      title: "General",
      presidentId: id,
      history: { messages: [], hasMore: false, offer: null },
      loading: false,
      error: "Backend no disponible",
    }),
  );
  assert.ok(
    html.includes('role="alert"') && html.includes("Backend no disponible"),
  );
  html = render(
    React.createElement(ChatRoom, {
      selection: { kind: "bot", targetId: null },
      title: "Bot 11Eleven",
      presidentId: id,
    }),
  );
  assert.ok(
    html.includes("Cargando conversación") &&
      html.includes("Buzón privado") &&
      !html.includes("<textarea"),
  );
  html = render(
    React.createElement(ChatRoom, {
      selection: { kind: "direct", targetId: id },
      title: "Privado",
      presidentId: id,
    }),
  );
  assert.ok(html.includes("<textarea") && html.includes("Enviar"));
  console.log(
    "PASS chat client: safe routing, length/Unicode validation, retry merge with 64-bit IDs, escaped message content, visible error/loading states, read-only bot and accessible composer.",
  );
} finally {
  await server.close();
}
