import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";
import React from "react";
import { MemoryRouter } from "react-router";
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
    parseBroadcastPlayback,
    broadcastEvidencePath,
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
  assert.ok(!page.includes("<Broadcast"));
  assert.ok(!page.includes('from "@/components/eleven/Broadcast"'));
  const query = "?video=EUpPyzN-sTU&t=4193";
  assert.deepEqual(parseBroadcastPlayback(query), {
    selection: "EUpPyzN-sTU",
    second: 4193,
  });
  assert.equal(
    broadcastEvidencePath("EUpPyzN-sTU", 4193),
    "/dashboard/transmision" + query,
  );
  for (const invalid of ["https://evil.example", "not-a-video", "live"])
    assert.equal(broadcastEvidencePath(invalid, 0), null);
  for (const second of [-1, 1.5, 86401, Number.NaN])
    assert.equal(broadcastEvidencePath("EUpPyzN-sTU", second), null);
  assert.deepEqual(
    parseBroadcastPlayback("?video=https%3A%2F%2Fevil.example&t=10"),
    { selection: "live", second: 0 },
  );
  assert.deepEqual(parseBroadcastPlayback("?video=EUpPyzN-sTU&t=-10"), {
    selection: "EUpPyzN-sTU",
    second: 0,
  });
  const { default: BroadcastPage } = await server.ssrLoadModule(
    "/src/pages/app/BroadcastPage.tsx",
  );
  const broadcastPage = renderToString(
    React.createElement(
      MemoryRouter,
      {
        basename: "/11eleven",
        initialEntries: ["/11eleven/dashboard/transmision" + query],
      },
      React.createElement(BroadcastPage),
    ),
  );
  assert.ok(broadcastPage.includes('<option value="EUpPyzN-sTU" selected="">'));
  assert.ok(broadcastPage.includes('href="/11eleven/dashboard/competicion"'));
  assert.ok(!broadcastPage.includes("Competiciones del Universo"));
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
  const result = renderToString(
    React.createElement(
      MemoryRouter,
      {
        basename: "/11eleven",
        initialEntries: ["/11eleven/dashboard/competicion"],
      },
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
            verifiedMatches: 1,
            standings: [],
            players: [],
            matches: [
              {
                id: "report",
                round: 11,
                stage: "Regular",
                homeId: "home",
                awayId: "away",
                home: "Home",
                away: "Away",
                homeGoals: 2,
                awayGoals: 0,
                homePenalties: null,
                awayPenalties: null,
                videoId: "EUpPyzN-sTU",
                evidenceSecond: 4193,
                verified: true,
                goals: null,
                assists: null,
                yellowCards: null,
                redCards: null,
                version: 1,
              },
            ],
          },
        ],
      }),
    ),
  );
  assert.ok(
    result.includes(
      'href="/11eleven/dashboard/transmision?video=EUpPyzN-sTU&amp;t=4193"',
    ),
  );
  assert.ok(result.includes("Ver evidencia en Transmisiones"));
  assert.ok(!result.includes("<iframe"));
  assert.ok(!result.includes("Seleccionar transmisión o grabación"));
  const { crestFor } = await server.ssrLoadModule("/src/lib/crests.ts");
  const sourceMatches = JSON.parse(
    readFileSync("data/broadcast-results/2026-11-06.json", "utf8"),
  ).matches;
  const catalogTeams = Object.keys(
    JSON.parse(readFileSync("src/lib/team-crests.json", "utf8")),
  );
  for (const team of new Set([
    ...catalogTeams,
    ...sourceMatches.flatMap((m) => [m.home, m.away]),
  ])) {
    const crest = crestFor(team);
    assert.ok(crest, `No crest for ${team}`);
    assert.ok(
      readFileSync("public/" + crest.replace(/^\//, "")).length > 100,
      `Missing asset for ${team}`,
    );
  }
  assert.equal(crestFor("  PALERMO  "), crestFor("Palermo FC"));
  assert.equal(crestFor("Parma"), crestFor("Parma Calcio 1913"));
  assert.equal(crestFor("Racing Strasbourg"), crestFor("RC Strasbourg"));
  assert.notEqual(crestFor("Racing Strasbourg"), crestFor("Racing Club"));
  assert.equal(crestFor("Unknown test club"), null);
  const { RecordedStandings, RecordedPlayerStats } = await server.ssrLoadModule(
    "/src/components/eleven/CompetitionTables.tsx",
  );
  const designFixture = {
    standings: [
      {
        team: "Palermo",
        played: 1,
        won: 1,
        drawn: 0,
        lost: 0,
        goalsFor: 2,
        goalsAgainst: 0,
        goalDifference: 2,
        points: 3,
      },
    ],
    format: "league",
    players: [
      {
        name: "Fixture A",
        team: "Parma",
        goals: null,
        assists: 1,
        yellowCards: null,
        redCards: 0,
      },
      {
        name: "Fixture B",
        team: "Racing Strasbourg",
        goals: 2,
        assists: 0,
        yellowCards: 1,
        redCards: null,
      },
    ],
  };
  const standings = renderToString(
    React.createElement(RecordedStandings, { competition: designFixture }),
  );
  assert.ok(standings.includes('scope="row"'));
  assert.ok(standings.includes("Escudo de Palermo"));
  assert.ok(standings.includes("/crests/palermo-fc.png"));
  assert.ok(standings.replace(/<!--.*?-->/g, "").includes("+2"));
  const players = renderToString(
    React.createElement(RecordedPlayerStats, { competition: designFixture }),
  );
  assert.ok(players.includes("/crests/parma.webp"));
  assert.ok(players.includes("/crests/rc-strasbourg.png"));
  assert.ok(players.includes('aria-label="Sin verificar"'));
  assert.ok(
    players.indexOf("Fixture B") < players.indexOf("Fixture A"),
    "Unknown stats must not outrank confirmed goals",
  );

  const { isCompetitionEvidencePath, competitionEvidenceImageUrl } =
    await server.ssrLoadModule("/src/lib/competition-evidence.ts");
  for (const bad of [
    "../bad.png",
    "evidence/../bad.png",
    "https://evil.example/a.png",
    "evidence/%2e%2e/a.png",
    null,
  ])
    assert.equal(isCompetitionEvidencePath(bad), false);
  assert.ok(
    competitionEvidenceImageUrl(
      "evidence/champions/2026/jornada-1-01.png",
    ).endsWith("/evidence/champions/2026/jornada-1-01.png"),
  );
  const rankedCup = renderToString(
    React.createElement(RecordedStandings, {
      competition: {
        ...designFixture,
        format: "cup",
        rankingPhase: "Fase de liga",
      },
    }),
  );
  assert.ok(rankedCup.includes("Escudo de Palermo"));
  const plainCup = renderToString(
    React.createElement(RecordedStandings, {
      competition: { ...designFixture, format: "cup" },
    }),
  );
  assert.ok(!plainCup.includes('scope="row"'));
  const { RecordedResults } = await server.ssrLoadModule(
    "/src/components/eleven/CompetitionTables.tsx",
  );
  const shotHtml = renderToString(
    React.createElement(RecordedResults, {
      competition: {
        ...designFixture,
        matches: [
          {
            id: "shot",
            round: 1,
            stage: "Fase de liga",
            home: "Palermo",
            away: "LA Galaxy",
            homeGoals: 0,
            awayGoals: 0,
            videoId: null,
            evidenceSecond: null,
            verified: true,
            goals: null,
            assists: null,
            yellowCards: null,
            redCards: null,
            homePenalties: null,
            awayPenalties: null,
            evidence: {
              kind: "screenshots",
              title: "J1",
              images: ["evidence/champions/2026/jornada-1-01.png"],
            },
          },
        ],
      },
    }),
  );
  assert.ok(shotHtml.includes("Ver capturas de la jornada"));
  assert.ok(!shotHtml.includes("Ver evidencia en Transmisiones"));

  console.log(
    "PASS broadcast: YouTube channel, 17 verified video IDs, 6 competition categories, muted autoplay, origin validation, inline playback, archive selection, no redirects, separate result/broadcast routes, safe evidence links with Pages basename, deep-linked video/timestamp, safe SSR and visible playback help.",
  );
} finally {
  await server.close();
}
