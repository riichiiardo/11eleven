import assert from "node:assert/strict";
import { createServer } from "vite";
import React from "react";
import { renderToString } from "react-dom/server";
const server = await createServer({
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const engine = await server.ssrLoadModule("/src/convex/rulesEngine.ts");
  const config = await server.ssrLoadModule("/src/lib/rule-configuration.ts");
  assert.equal(engine.FORMATION_CODES.length, 30);
  for (const code of engine.FORMATION_CODES) {
    const slots = engine.FORMATIONS[code].slots;
    assert.equal(slots.length, 11, code);
    assert.equal(new Set(slots.map((s) => s.id)).size, 11, code);
  }
  assert.ok(
    !engine.RULE_DESCRIPTORS.some((r) => ["R-08", "R-09"].includes(r.code)),
  );
  const c = config.configurationFor(engine.DEFAULT_RULES);
  c.groups.GK.enabled = false;
  c.competitions = [
    {
      id: "a",
      name: "Liga",
      kind: "league",
      rounds: 2,
      playoffTeams: 0,
      promotions: 0,
      relegations: 0,
      promotionTarget: "",
      relegationTarget: "",
      u20: { enabled: true, min: 1, max: 2 },
      nationals: { enabled: true, min: 1, max: 11 },
      nationality: "México",
      customRules: [],
    },
    {
      id: "b",
      name: "Copa",
      kind: "cup",
      rounds: 1,
      playoffTeams: 0,
      promotions: 0,
      relegations: 0,
      promotionTarget: "",
      relegationTarget: "",
      u20: { enabled: false, min: 0, max: 11 },
      nationals: { enabled: false, min: 0, max: 11 },
      nationality: "",
      customRules: [],
    },
  ];
  c.activeCompetitionId = "a";
  assert.ok(config.ruleConfigurationSchema.safeParse(c).success);
  const rules = config.effectiveRules({
    ...engine.DEFAULT_RULES,
    configuration: c,
  });
  assert.equal(rules.gkMin, 0);
  assert.equal(rules.gkMax, c.squadSize);
  const player = {
    age: 19,
    nationality: "Mexico",
    position: "MC",
    ovr: 80,
    value: 100,
  };
  assert.ok(
    config
      .additionalChecks(rules, [player], [player], "xi")
      .every((x) => x.passed),
  );
  assert.ok(
    config.additionalChecks(rules, [], [], "xi").some((x) => !x.passed),
  );
  assert.ok(
    config
      .additionalChecks(
        { ...rules, configuration: { ...c, activeCompetitionId: "b" } },
        [],
        [],
        "xi",
      )
      .every((x) => x.passed),
  );
  assert.ok(
    !config.ruleConfigurationSchema.safeParse({
      ...c,
      groups: { ...c.groups, GK: { enabled: true, min: 5, max: 1 } },
    }).success,
  );
  assert.ok(
    !engine
      .evaluateSquadRules(engine.DEFAULT_RULES, [], 1000)
      .checks.some((x) => x.id === "u21"),
  );
  const { MemoryRouter } = await server.ssrLoadModule("react-router");
  const { DashboardStateProvider } = await server.ssrLoadModule(
    "/src/pages/app/dashboard-context.tsx",
  );
  const { default: Rules } = await server.ssrLoadModule(
    "/src/pages/app/Rules.tsx",
  );
  const html = renderToString(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        DashboardStateProvider,
        {
          state: {
            rules,
            isAdmin: true,
            tournament: { id: "test", name: "Universe" },
          },
        },
        React.createElement(Rules),
      ),
    ),
  );
  for (const label of [
    "Presupuesto inicial en euros",
    "Aumentar Jugadores en plantilla",
    "Crear competición",
    "Crear regla parametrizable",
    "Editar reglas",
  ])
    assert.ok(html.includes(label), label);
  assert.ok(/<fieldset[^>]*disabled/.test(html), "Rules initially read-only");
  assert.ok(!html.includes(">Guardar<"), "Save only appears in editing mode");
  assert.ok(
    !html.includes(">Cancelar<"),
    "Cancel only appears in editing mode",
  );
  console.log(
    "Rules: 30 valid formations; removed R08/R09; disabled ranges; per-competition XI; invalid bounds rejected; editor rendered.",
  );
} finally {
  await server.close();
}
