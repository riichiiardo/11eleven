import { readFile, access, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("src/lib/team-crests.json", root), "utf8"));
assert.equal(Object.keys(manifest).length, 18);
for (const [name, entry] of Object.entries(manifest)) {
  const target = new URL(`public/${entry.path}`, root);
  try {
    await access(target);
  } catch {
    assert.ok(process.argv.includes("--download"), `${name}: missing ${entry.path}`);
    assert.ok(entry.source, `${name}: no download source`);
    const response = await fetch(entry.source);
    assert.ok(response.ok, `${name}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(response.headers.get("content-type")?.startsWith("image/"));
    await writeFile(target, bytes, { flag: "wx" });
  }
  const bytes = await readFile(target);
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isWebp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  assert.ok(isPng || isWebp, `${name}: invalid image signature`);
  assert.ok(bytes.length > 100, `${name}: empty image`);
  if (process.argv.includes("--published")) {
    const response = await fetch(`https://riichiiardo.github.io/11eleven/${entry.path}`);
    assert.ok(response.ok, `${name}: published HTTP ${response.status}`);
    assert.ok(response.headers.get("content-type")?.startsWith("image/"));
    assert.ok(Buffer.from(await response.arrayBuffer()).equals(bytes), `${name}: published image differs from repository`);
  }
  console.log(`${name}: ${entry.path} (${bytes.length} bytes)`);
}
console.log("18/18 club crests present and valid.");
