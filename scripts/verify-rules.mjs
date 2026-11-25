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
    [20, 5, 4],
  );
  const requested = FORMATION_GROUPS.flatMap((g) =>
    g.families.flatMap((f) => f.variants),
  );
  assert.equal(new Set(requested.map((v) => v.code)).size, 29);
  assert.equal(engine.FORMATION_CODES.length, 91);
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
  const { FormationMiniPitch } = await server.ssrLoadModule(
    "/src/components/eleven/FormationMiniPitch.tsx",
  );
  for (const option of requested) {
    const actual = engine.FORMATIONS[option.code].slots;
    const original = option.slots;
    const minimum = Math.min(...original.map((s) => s.y)),
      maximum = original.find((s) => s.role === "POR").y;
    assert.equal(actual.length, original.length);
    actual.forEach((slot, index) => {
      assert.equal(slot.role, original[index].role);
      assert.equal(slot.x, original[index].x);
      assert.ok(
        Math.abs(
          slot.y -
            (12 + ((original[index].y - minimum) / (maximum - minimum)) * 77),
        ) < 1e-9,
      );
      assert.ok(slot.x >= 5 && slot.x <= 95 && slot.y >= 12 && slot.y <= 89);
    });
    const mini = renderToString(
      React.createElement(FormationMiniPitch, { formation: option.code }),
    );
    for (const slot of actual)
      assert.ok(
        mini.includes(
          `data-slot="${slot.id}" data-x="${slot.x}" data-y="${slot.y}"`,
        ),
        option.code,
      );
  }
  const { PitchView } = await server.ssrLoadModule(
    "/src/components/eleven/PitchView.tsx",
  );
  const portraitCode = "4-3-3 · FC27";
  const portraitSlots = engine.FORMATIONS[portraitCode].slots;
  const faces = portraitSlots.map((slot, index) => ({
    playerId: `face-${index}`,
    name: `Player ${index}`,
    position: slot.label,
    group: slot.group,
    ovr: index === 1 ? 86 : index === 2 ? 85 : 83,
    photo: `https://example.invalid/${index}.png`,
    flag: "",
  }));
  const faceHtml = renderToString(
    React.createElement(PitchView, {
      formation: portraitCode,
      lineup: {
        formation: portraitCode,
        slots: portraitSlots.map((slot, index) => ({
          slotId: slot.id,
          playerId: `face-${index}`,
        })),
      },
      squad: faces,
    }),
  );
  assert.equal((faceHtml.match(/border-radius:50%/g) || []).length, 11);
  assert.ok(faceHtml.includes('src="https://example.invalid/0.png"'));
  for (const rating of [83, 86, 85])
    assert.ok(faceHtml.includes(String(rating)));
  assert.ok(/>C<\//.test(faceHtml));
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
  const griezmann = { position: "DC", positions: ["DC", "MCO", "MC"] };
  const midfielder = { label: "MC", accepts: ["MC"] };
  assert.equal(engine.canOccupySlot(griezmann, midfielder), true);
  assert.equal(engine.canOccupySlot(griezmann, { label: "DFC", accepts: ["DFC"] }), false);
  assert.equal(engine.canOccupySlot({ position: "MC", positions: ["MD", "MC"] }, { label: "MC", role: "MD", accepts: ["MC"] }), true);
  const player = {
    age: 19,
    nationality: "Mexico",
    position: "MC",
    ovr: 80,
    value: 100,
  };
  assert.ok(
    config
      .additionalChecks(rules, [player], [player], "xi", undefined, "México")
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
    "Plantilla y presupuesto",
    "Formación, draft y reglas generales",
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
    "Rules: 29 FUTBIN formations and 62 compatible previous formations; removed R08/R09; disabled ranges; per-competition XI; invalid bounds rejected; editor rendered.",
  );
} finally {
  await server.close();
}
