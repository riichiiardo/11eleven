import assert from "node:assert/strict";
import { readdir, readFile, access } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(import.meta.dirname, "..");
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : file;
  }))).flat();
}
const source = await walk(path.join(root, "src"));

test("active source has no JavaScript copies that can shadow TypeScript", () => {
  assert.deepEqual(source.filter((file) => /\.jsx?$/.test(file)), []);
});

test("runtime does not import archived or Convex implementations", async () => {
  for (const file of source.filter((file) => /\.tsx?$/.test(file))) {
    const text = await readFile(file, "utf8");
    const imports = [...text.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)];
    for (const [, specifier] of imports) {
      assert.ok(!/(?:^convex\/|^@convex-dev\/|^@\/convex|legacy\/)/.test(specifier), `${file}: ${specifier}`);
      if (file.includes(`${path.sep}domain${path.sep}`)) {
        assert.ok(!/^(?:react|@supabase|@\/infrastructure|@\/services)/.test(specifier), `${file}: domain must be pure`);
      }
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const base = specifier.startsWith("@/")
          ? path.join(root, "src", specifier.slice(2))
          : path.resolve(path.dirname(file), specifier);
        const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, path.join(base, "index.ts")];
        const exists = await Promise.all(candidates.map((item) => access(item).then(() => true, () => false)));
        assert.ok(exists.some(Boolean), `${file}: missing import ${specifier}`);
      }
    }
  }
});

test("single package manager, explicit typechecking and offline tests", async () => {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  assert.ok(pkg.scripts.check && pkg.scripts.test && pkg.scripts.typecheck);
  assert.ok(!pkg.dependencies.convex && !pkg.dependencies["@convex-dev/auth"]);
  await access(path.join(root, "package-lock.json"));
  await assert.rejects(access(path.join(root, "bun.lock")));
  await assert.rejects(access(path.join(root, "legacy")));
  await assert.rejects(access(path.join(root, "supabase", "seed.sql")));
});
