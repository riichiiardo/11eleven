/** Credential-free regression suite. No test talks to production. */
import { spawnSync } from "node:child_process";

const suites = [
  ["--test", "tests/architecture.test.mjs", "tests/query-store.test.mjs"],
  ["scripts/verify-rules.mjs"],
  ["scripts/verify-dashboard.mjs"],
  ["scripts/verify-admin.mjs"],
  ["scripts/verify-draft-client.mjs"],
  ["scripts/validate-sql.ts"],
  ["scripts/verify-draft-prelists.mjs"],
  ["scripts/verify-draft-outgoing.mjs"],
  ["scripts/verify-draft-bids.mjs"],
  ["scripts/verify-chat.mjs"],
  ["scripts/verify-chat-client.mjs"],
];

for (const args of suites) {
  console.log(`\nRunning ${args.join(" ")}`);
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      // The client suites render without a real backend; SQL runs in PGlite.
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`\nAll ${suites.length} local regression suites passed.`);
