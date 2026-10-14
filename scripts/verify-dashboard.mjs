import assert from "node:assert/strict";
import { createServer } from "vite";
import React from "react";
import { renderToString } from "react-dom/server";

const server = await createServer({
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { adaptTournamentState } = await server.ssrLoadModule("/src/lib/supabase/adapters.ts");
  const { DEFAULT_RULES, computeSquadStats } = await server.ssrLoadModule("/src/convex/rulesEngine.ts");
  const raw = {
    needsLeague: false, needsClub: false,
    rules: DEFAULT_RULES, club: { name: "Test Club", shortName: "TST", country: "España", colorPrimary: "#000000", colorSecondary: "#ffffff" },
    squad: [], budget: { available: 350000000 },
    president: { nickname: "Test" },
    tournament: { status: "inscripciones", name: "Test League", currentMatchday: 1 },
    stats: computeSquadStats([]), activity: [],
    competition: { standings: [], previousMatch: null, myMatch: null },
    market: { freeAgents: 0 }, draft: null,
    availability: {},
  };
  const ready = adaptTournamentState(raw);
  assert.equal(ready.lineup.slots.length, 11);
  assert.ok(ready.evaluation);
  assert.ok(ready.lineupEvaluation);
  assert.ok(Array.isArray(ready.actions));
  assert.deepEqual(ready.lineupEvaluation.starters, []);
  assert.equal(ready.lineupEvaluation.valid, false);
  const saved = { formation: "4-2-3-1", slots: [{ slotId: "GK", playerId: null }] };
  assert.deepEqual(adaptTournamentState({ ...raw, lineup: saved }).lineup, saved);
  assert.equal(adaptTournamentState(null), null);
  const gate = { needsClub: true };
  assert.equal(adaptTournamentState(gate), gate);
  const { MemoryRouter } = await server.ssrLoadModule("react-router");
  for (const name of ["Home", "Club", "Squad", "Formation"]) {
    const { default: Page } = await server.ssrLoadModule(`/src/pages/app/${name}.tsx`);
    const html = renderToString(React.createElement(MemoryRouter, null, React.createElement(Page, { state: ready })));
    assert.ok(html.length > 500, `${name} must render content`);
    assert.ok(!html.includes("No se pudieron cargar"), `${name} must render its module rather than an error placeholder`);
    console.log(`${name}: rendered successfully with the repaired RPC contract.`);
  }
  console.log("Dashboard contract: missing XI repaired, saved XI preserved, empty roster and onboarding handled.");
} finally {
  await server.close();
}
