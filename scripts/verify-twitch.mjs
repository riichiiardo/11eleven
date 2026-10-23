import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";
import React from "react";
import { renderToString } from "react-dom/server";
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { twitchEmbedUrl, TWITCH_CHANNEL_URL } = await server.ssrLoadModule(
    "/src/domain/twitch.ts",
  );
  for (const hostname of [
    "riichiiardo.github.io",
    "localhost",
    "127.0.0.1",
    "app.example.com",
  ]) {
    const url = new URL(twitchEmbedUrl(hostname));
    assert.equal(url.origin, "https://player.twitch.tv");
    assert.equal(url.searchParams.get("parent"), hostname);
    assert.equal(url.searchParams.get("channel"), "superliganova");
    assert.equal(url.searchParams.get("autoplay"), "false");
    assert.equal(url.searchParams.get("muted"), "true");
    assert.ok(!url.searchParams.has("token"));
  }
  for (const hostname of [
    "",
    "https://riichiiardo.github.io",
    "example.com/11eleven",
    "example.com:5173",
    "evil.com&parent=evil",
    "bad host",
    "-bad.com",
    "a".repeat(64) + ".com",
  ])
    assert.equal(twitchEmbedUrl(hostname), null);
  const { TwitchBroadcast } = await server.ssrLoadModule(
    "/src/components/eleven/TwitchBroadcast.tsx",
  );
  const html = renderToString(React.createElement(TwitchBroadcast));
  assert.ok(html.includes(TWITCH_CHANNEL_URL));
  assert.ok(
    html.includes("Ver transmisión") && html.includes("Abrir en Twitch"),
  );
  assert.ok(html.includes("no modifica por sí solo"));
  assert.ok(html.includes("noopener noreferrer"));
  assert.ok(
    !html.includes("<iframe"),
    "No contact with Twitch before viewer opens player",
  );
  assert.ok(!html.includes("EN DIRECTO"), "Do not invent an online status");
  const page = readFileSync("src/pages/app/Competition.tsx", "utf8");
  assert.equal(
    (page.match(/<TwitchBroadcast \/>/g) ?? []).length,
    2,
    "Channel works with and without generated calendar",
  );
  console.log(
    "PASS Twitch: channel, dynamic parent, safe URLs, no autoplay/tracking before opening, fallback link, truthful status and no dependency on calendar availability.",
  );
} finally {
  await server.close();
}
