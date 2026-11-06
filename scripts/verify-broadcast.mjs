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
  const {
    BROADCAST_CHANNEL_ID,
    BROADCAST_RECORDINGS,
    BROADCAST_COMPETITIONS,
    youtubeEmbedUrl,
  } = await server.ssrLoadModule("/src/domain/broadcast.ts");
  assert.equal(BROADCAST_RECORDINGS.length, 17);
  assert.equal(new Set(BROADCAST_RECORDINGS.map((v) => v.id)).size, 17);
  assert.equal(BROADCAST_COMPETITIONS.length, 6);
  for (const video of BROADCAST_RECORDINGS) {
    assert.match(video.id, /^[\w-]{11}$/);
    assert.ok(BROADCAST_COMPETITIONS.some((c) => c.slug === video.competition));
  }
  for (const origin of [
    "https://riichiiardo.github.io",
    "http://localhost:5173",
    "http://127.0.0.1:5189",
  ])
    for (const id of ["live", ...BROADCAST_RECORDINGS.map((v) => v.id)]) {
      const u = new URL(youtubeEmbedUrl(id, origin));
      assert.equal(u.origin, "https://www.youtube.com");
      assert.ok(u.pathname.startsWith("/embed/"));
      assert.equal(u.searchParams.get("origin"), origin);
      assert.equal(u.searchParams.get("autoplay"), "1");
      assert.equal(u.searchParams.get("mute"), "1");
      assert.equal(u.searchParams.get("playsinline"), "1");
      if (id === "live")
        assert.equal(u.searchParams.get("channel"), BROADCAST_CHANNEL_ID);
      else assert.equal(u.pathname, "/embed/" + id);
    }
  for (const origin of [
    "",
    "javascript:alert(1)",
    "https://user:pass@example.com",
    "https://example.com/path",
    "https://example.com?x=1",
  ])
    assert.equal(youtubeEmbedUrl("live", origin), null);
  assert.equal(
    youtubeEmbedUrl("https://evil.example", "https://example.com"),
    null,
  );
  assert.equal(
    new URL(
      youtubeEmbedUrl("EUpPyzN-sTU", "https://riichiiardo.github.io", 120),
    ).searchParams.get("start"),
    "120",
  );
  assert.equal(youtubeEmbedUrl("EUpPyzN-sTU", "https://example.com", -1), null);
  assert.equal(
    youtubeEmbedUrl("EUpPyzN-sTU", "https://example.com", 1.5),
    null,
  );
  const { Broadcast } = await server.ssrLoadModule(
    "/src/components/eleven/Broadcast.tsx",
  );
  const html = renderToString(React.createElement(Broadcast));
  assert.ok(html.includes("YouTube"));
  assert.ok(html.includes("SUPERNOVALEAGUEKTV"));
  assert.ok(html.includes('role="note"'));
  assert.ok(html.includes("sin salir de 11Eleven"));
  assert.equal((html.match(/<option/g) ?? []).length, 18);
  assert.ok(!html.includes("<a "));
  assert.ok(!html.includes("Twitch"));
  assert.ok(!html.includes("<iframe"));
  const component = readFileSync("src/components/eleven/Broadcast.tsx", "utf8");
  assert.ok(
    component.includes(
      "autoplay; encrypted-media; fullscreen; picture-in-picture",
    ),
  );
  assert.ok(!component.includes("window.location.href"));
  const page = readFileSync("src/pages/app/Competition.tsx", "utf8");
  assert.equal((page.match(/<Broadcast \/>/g) ?? []).length, 2);
  const { CompetitionArchiveView } = await server.ssrLoadModule(
    "/src/components/eleven/CompetitionArchive.tsx",
  );
  let archive = renderToString(
    React.createElement(CompetitionArchiveView, {
      data: null,
      error: "Error de prueba",
    }),
  );
  assert.ok(archive.includes('role="alert"'));
  assert.ok(!archive.includes("Cargando competiciones"));
  archive = renderToString(
    React.createElement(CompetitionArchiveView, { data: [] }),
  );
  assert.ok(archive.includes("todavía no tiene competiciones"));
  archive = renderToString(
    React.createElement(CompetitionArchiveView, {
      data: [
        {
          id: "first",
          slug: "primera",
          name: "Primera",
          format: "league",
          season: "2026",
          reviewFrom: 9,
          latestRound: 11,
          videoCount: 4,
          verifiedMatches: 0,
          standings: [],
          matches: [],
          players: [],
        },
      ],
    }),
  );
  assert.ok(archive.replace(/<!--.*?-->/g, "").includes("J1:"));
  assert.ok(archive.includes("pendiente de archivo"));
  assert.ok(archive.includes("pendiente de revisión"));
  assert.ok(archive.includes("Aún no hay resultados revisados"));
  assert.ok(!archive.includes("0–0"));
  console.log(
    "PASS broadcast: YouTube channel, 17 verified video IDs, 6 competition categories, muted autoplay, origin validation, inline playback, archive selection, no redirects, safe SSR and visible playback help.",
  );
} finally {
  await server.close();
}
