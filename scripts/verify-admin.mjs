import assert from "node:assert/strict";
import { createServer } from "vite";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";

const server = await createServer({
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { adaptAdminOverview } = await server.ssrLoadModule(
    "/src/infrastructure/supabase/adapters.ts",
  );
  assert.equal(adaptAdminOverview(null), null);
  const overview = adaptAdminOverview({
    draft: null,
    market: null,
    competition: { available: false },
    totals: null,
    clubs: null,
  });
  assert.equal(overview.draft.status, null);
  assert.deepEqual(overview.draft.turnOrder, []);
  assert.deepEqual(overview.draft.picks, []);
  assert.deepEqual(overview.draft.unsignedPresidents, []);
  assert.equal(overview.draft.totalPicks, 0);
  assert.deepEqual(overview.market.reserved, []);
  assert.deepEqual(overview.competition.matchdays, []);
  assert.deepEqual(overview.clubs, []);
  const prepared = adaptAdminOverview({
    draft: {
      status: "pausado",
      totalPicks: 7,
      turnOrder: [{ nickname: "Test" }],
      picks: null,
    },
  });
  assert.equal(prepared.draft.status, "pausado");
  assert.equal(prepared.draft.totalPicks, 7);
  assert.equal(prepared.draft.turnOrder.length, 1);
  assert.deepEqual(prepared.draft.picks, []);
  const { DraftPanel } = await server.ssrLoadModule("/src/pages/app/Admin.tsx");
  const html = renderToString(React.createElement(DraftPanel, { overview }));
  for (const label of [
    "Sin preparar",
    "Preparar draft",
    "Todavía no hay un orden de turnos",
    "Cada adquisición del draft",
  ])
    assert.ok(html.includes(label), label);
  assert.ok(
    !html.includes("Abrir draft"),
    "Opening must not be offered before preparation",
  );
  const { SectionErrorBoundary } = await server.ssrLoadModule(
    "/src/components/eleven/SectionErrorBoundary.tsx",
  );
  const boundary = new SectionErrorBoundary({ children: null });
  boundary.state = SectionErrorBoundary.getDerivedStateFromError();
  const recovery = renderToString(
    React.createElement(MemoryRouter, null, boundary.render()),
  );
  for (const label of [
    "No se pudo mostrar esta sección",
    "Reintentar",
    "Volver al inicio",
  ])
    assert.ok(recovery.includes(label), label);
  console.log(
    "Admin: null/missing draft renders prepare screen; optional collections normalized; prepared draft retained.",
  );
} finally {
  await server.close();
}
