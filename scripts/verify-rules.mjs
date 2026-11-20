import assert from "node:assert/strict";
import { createServer } from "vite";
import React from "react";
import { renderToString } from "react-dom/server";
const server = await createServer({
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const engine = await server.ssrLoadModule("/src/domain/rulesEngine.ts");
  const config = await server.ssrLoadModule("/src/lib/rule-configuration.ts");
  const { FORMATION_GROUPS } = await server.ssrLoadModule(
    "/src/domain/formation-catalog.ts",
  );
  assert.deepEqual(
    FORMATION_GROUPS.map((g) => g.defenders),
    [4, 3, 5],
  );
  assert.deepEqual(
    FORMATION_GROUPS.map((g) => g.families.flatMap((f) => f.variants).length),
    [20, 6, 6],
  );
  const requested = FORMATION_GROUPS.flatMap((g) =>
    g.families.flatMap((f) => f.variants),
  );
  assert.equal(new Set(requested.map((v) => v.code)).size, 32);
  assert.equal(engine.FORMATION_CODES.length, 62);
  const roster = [
    "POR",
    "LI",
    "LD",
    "DFC",
    "MCD",
    "MC",
    "MCO",
    "EI",
    "ED",
    "DC",
  ].flatMap((position) =>
    Array.from({ length: 8 }, (_, i) => ({
      playerId: `${position}-${i}`,
      name: `${position} ${i}`,
      position,
      group: engine.groupOf(position),
      ovr: 80 - i,
      age: 25,
      nationality: "España",
      value: 1000000,
    })),
  );
  for (const group of FORMATION_GROUPS)
    for (const option of group.families.flatMap((f) => f.variants)) {
      const slots = engine.FORMATIONS[option.code].slots;
      assert.equal(
        slots.filter((s) => s.group === "DEF").length,
        group.defenders,
        option.code,
      );
      assert.equal(slots.filter((s) => s.label === "POR").length, 1);
      assert.equal(new Set(slots.map((s) => `${s.x},${s.y}`)).size, 11);
      const initial = engine.autoLineup(roster, option.code);
      assert.equal(
        initial.slots.filter((s) => s.playerId).length,
        11,
        option.code,
      );
      const remapped = engine.remapLineup(roster, option.code, initial);
      assert.equal(new Set(remapped.slots.map((s) => s.playerId)).size, 11);
    }
  const roles = (code) =>
    engine.FORMATIONS[code].slots.map((s) => s.role ?? s.label);
  assert.equal(
    roles("4-2-3-1 · Estrecha").filter((p) => p === "MCO").length,
    3,
  );
  assert.ok(roles("4-2-3-1 · Abierta").includes("MI"));
  assert.ok(roles("4-2-3-1 · Abierta").includes("MD"));
  assert.equal(roles("4-3-3 · Defensiva").filter((p) => p === "MCD").length, 2);
  assert.equal(roles("4-3-3 · Plana").filter((p) => p === "MC").length, 3);
  assert.ok(roles("4-3-3 · Falso 9").includes("SD"));
  assert.equal(
    roles("4-3-1-2 · Tres MC y un MCO").filter((p) => p === "MC").length,
    3,
  );
  assert.equal(
    roles("4-2-4 · Dos MC y cuatro atacantes").filter((p) => p === "MC").length,
    2,
  );
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
    "Rules: 32 grouped tactical variants and 30 compatible saved formations; removed R08/R09; disabled ranges; per-competition XI; invalid bounds rejected; editor rendered.",
  );
} finally {
  await server.close();
}
