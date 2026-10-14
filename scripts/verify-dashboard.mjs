import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { adaptTournamentState } = await server.ssrLoadModule("/src/lib/supabase/adapters.ts");
  const { DEFAULT_RULES } = await server.ssrLoadModule("/src/convex/rulesEngine.ts");
  const raw = {
    needsLeague: false, needsClub: false,
    rules: DEFAULT_RULES, club: { name: "Test Club", country: "España" },
    squad: [], budget: { available: 350000000 },
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
  console.log("Dashboard contract: missing XI repaired, saved XI preserved, empty roster and onboarding handled.");
} finally {
  await server.close();
}
