import assert from "node:assert/strict";
import { createServer } from "vite";
import React from "react";
import { renderToString } from "react-dom/server";
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { validSofifaUrl, prelistEntrySchema, validatePrelist } =
    await server.ssrLoadModule("/src/lib/draft-prelist.ts");
  assert.ok(validSofifaUrl("https://sofifa.com/player/12345/name/270002/"));
  for (const value of [
    "http://sofifa.com/player/1",
    "https://sofifa.com.evil.invalid/player/1",
    "https://user@sofifa.com/player/1",
    "javascript:alert(1)",
    "https://sofifa.com/team/1",
    "https://sofifa.com/player/0",
  ])
    assert.ok(!validSofifaUrl(value), value);
  const entry = {
    kind: "new",
    name: "Carlos Nuevo",
    price: 100.25,
    ovr: 80,
    positions: ["MC", "MCO"],
    nationality: "Colombia",
    sofifaUrl: "https://sofifa.com/player/12345/carlos-nuevo/",
  };
  assert.ok(prelistEntrySchema.safeParse(entry).success);
  for (const patch of [
    { price: 0 },
    { price: 1.001 },
    { ovr: 100 },
    { ovr: 80.5 },
    { positions: [] },
    { positions: ["MC", "MC"] },
    { nationality: "" },
    { name: "Carlos" },
    { sofifaUrl: "" },
    { sofifaUrl: undefined },
    { sofifaUrl: "https://sofifa.com.evil.invalid/player/1" },
  ])
    assert.ok(!prelistEntrySchema.safeParse({ ...entry, ...patch }).success);
  assert.throws(() => validatePrelist([entry, entry], [], 6), /repetir/);
  assert.throws(() => validatePrelist([entry], [], 0), /máximo/);
  assert.throws(() => validatePrelist([], Array(7).fill("id"), 6), /máximo/);
  assert.throws(
    () =>
      validatePrelist(
        [],
        Array.from({ length: 7 }, (_, i) => String(i)),
        7,
      ),
    /máximo/,
  );
  const { configurationFor, ruleConfigurationSchema } =
    await server.ssrLoadModule("/src/lib/rule-configuration.ts");
  const { DEFAULT_RULES } = await server.ssrLoadModule(
    "/src/domain/rulesEngine.ts",
  );
  const config = configurationFor(DEFAULT_RULES);
  assert.deepEqual(config.draft, { maxTransfers: 6, extraPlayer: false });
  const { draft, ...legacy } = config;
  assert.deepEqual(
    configurationFor({ ...DEFAULT_RULES, configuration: legacy }).draft,
    draft,
  );
  assert.deepEqual(ruleConfigurationSchema.parse(legacy).draft, draft);
  assert.ok(
    !ruleConfigurationSchema.safeParse({
      ...config,
      draft: { maxTransfers: 6.5, extraPlayer: true },
    }).success,
  );
  const { DraftPrelist } = await server.ssrLoadModule(
    "/src/components/eleven/DraftPrelist.tsx",
  );
  const html = renderToString(React.createElement(DraftPrelist));
  assert.ok(html.includes("Mi prelista del draft"));
  assert.ok(html.includes("Cargando prelista"));
  const { DraftOutgoing } = await server.ssrLoadModule(
    "/src/components/eleven/DraftOutgoing.tsx",
  );
  const outgoingHtml = renderToString(
    React.createElement(DraftOutgoing, {
      players: [],
      selected: [],
      limit: 7,
      revision: 0,
      onChange: () => {},
    }),
  );
  assert.ok(outgoingHtml.includes("máximo <!-- -->6"));
  assert.ok(outgoingHtml.includes("75 %"));
  assert.ok(outgoingHtml.includes("aceptado o reservado"));
  const { DraftReviews } = await server.ssrLoadModule(
    "/src/components/eleven/DraftReviews.tsx",
  );
  assert.ok(
    renderToString(React.createElement(DraftReviews)).includes(
      "Revisión de prelistas del draft",
    ),
  );
  console.log(
    "Draft client OK: form validation, safe URLs, duplicate and limit checks, legacy defaults, rule validation and non-blank rendering.",
  );
} finally {
  await server.close();
}
