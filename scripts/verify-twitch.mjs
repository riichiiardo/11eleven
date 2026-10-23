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
    assert.equal(url.searchParams.get("autoplay"), "true");
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
    html.includes("Cerrar reproductor") && html.includes("Abrir en Twitch"),
  );
  assert.ok(html.includes("los resultados del torneo"));
  assert.ok(html.includes("se carga automáticamente"));
  assert.ok(html.includes('role="note"'));
  assert.ok(html.includes("Ayuda para reproducir la transmisión"));
  assert.ok(html.includes("¿El video no se inicia automáticamente?"));
  assert.ok(html.includes("Pulsa el botón Reproducir"));
  assert.ok(html.includes("sin salir de 11Eleven"));
  assert.ok(html.includes("empieza sin sonido"));
  assert.ok(html.includes("noopener noreferrer"));
  assert.ok(
    !html.includes("<iframe"),
    "SSR waits for browser hostname and measured container before mounting iframe",
  );
  assert.ok(!html.includes("EN DIRECTO"), "Do not invent an online status");
  const component = readFileSync(
    "src/components/eleven/TwitchBroadcast.tsx",
    "utf8",
  );
  assert.ok(
    component.includes('allow="autoplay; fullscreen; picture-in-picture"'),
  );
  assert.ok(
    !component.includes("window.location.href"),
    "No automatic redirect to Twitch",
  );
  const page = readFileSync("src/pages/app/Competition.tsx", "utf8");
  assert.equal(
    (page.match(/<TwitchBroadcast \/>/g) ?? []).length,
    2,
    "Channel works with and without generated calendar",
  );
  console.log(
    "PASS Twitch: channel, dynamic parent, safe URLs, muted autoplay and iframe permission, no redirect, browser fallback copy, truthful status and no dependency on calendar availability.",
  );
} finally {
  await server.close();
}
