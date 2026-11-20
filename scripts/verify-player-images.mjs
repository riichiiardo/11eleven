import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import {
  normalizePlayerImage,
  playerImageCandidates,
  validPortraitPng,
} from "../src/domain/player-image.ts";
import { parsePoolCsv } from "../src/domain/player-pool.ts";
const url = "https://cdn.sofifa.net/players/086/218/27_120.png";
assert.equal(normalizePlayerImage(url, "86218"), url);
assert.equal(
  normalizePlayerImage(
    `<td><img src="placeholder.png" data-src="${url}"></td><td><img src="other.png"></td>`,
    "86218",
  ),
  url,
);
assert.equal(normalizePlayerImage(url.replace("https:", ""), "86218"), url);
assert.equal(normalizePlayerImage("", "86218"), undefined);
for (const bad of [
  url.replace("86218", "123"),
  "http://localhost/a.png",
  "https://cdn.sofifa.net.evil.test/a.png",
  url + "?redirect=1",
  "data:image/png;base64,aaa",
]) {
  if (bad !== url) assert.throws(() => normalizePlayerImage(bad, "86218"));
}
assert.throws(() => normalizePlayerImage(url, "86219"));
assert.deepEqual(playerImageCandidates(url), [url.replace("120", "240"), url]);
const header =
  "ID,Imagen_URL,Nombre y Apellido,Nacionalidad,Posiciones,Edad,Valoración General,Potencial,Equipo,Valor";
assert.equal(
  parsePoolCsv(header + `\n86218,${url},Name,España,MC,25,80,85,Club,€1M`)[0]
    .imageUrl,
  url,
);
assert.equal(
  validPortraitPng(new TextEncoder().encode("<html>blocked</html>")),
  false,
);
const png = new Uint8Array(64);
png.set([137, 80, 78, 71, 13, 10, 26, 10]);
const view = new DataView(png.buffer);
view.setUint32(16, 120);
view.setUint32(20, 120);
assert.equal(validPortraitPng(png), true);
const originalDeno = globalThis.Deno;
globalThis.Deno = {
  serve() {},
  env: {
    get() {
      return undefined;
    },
  },
};
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("npm:@supabase/supabase-js"))
      return {
        url: 'data:text/javascript,export const createClient=()=>{throw Error("No network in tests");}',
        shortCircuit: true,
      };
    return next(specifier, context);
  },
});
try {
  const { downloadPortrait } =
    await import("../supabase/functions/player-portraits/index.ts");
  const seen = [];
  const bytes = await downloadPortrait(url, "86218", async (target) => {
    seen.push(target);
    return target.endsWith("_240.png")
      ? new Response("", { status: 404 })
      : new Response(png, { headers: { "Content-Type": "image/png" } });
  });
  assert.equal(bytes.length, png.length);
  assert.equal(seen.length, 2);
  let attempts = 0;
  await assert.rejects(
    downloadPortrait(url, "86218", async () => {
      attempts++;
      return new Response("blocked", { status: 403 });
    }),
    /HTTP 403/,
  );
  assert.equal(attempts, 1);
  await assert.rejects(
    downloadPortrait(
      url,
      "86218",
      async () =>
        new Response("<html>challenge</html>", {
          headers: { "Content-Type": "text/html" },
        }),
    ),
    /PNG/,
  );
  await assert.rejects(
    downloadPortrait(
      url,
      "86218",
      async () =>
        new Response(png, {
          headers: { "Content-Type": "image/png", "Content-Length": "3000000" },
        }),
    ),
    /2 MB/,
  );
  console.log(
    "PASS portraits: lazy-loading extraction, HTTPS/ID validation, resolution fallback, PNG validation, blocked-source stop and bounded downloads.",
  );
} finally {
  hooks.deregister();
  globalThis.Deno = originalDeno;
}
