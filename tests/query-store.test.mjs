import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryStore } from "../src/services/backend/query-store.ts";

test("simultaneous consumers share one request and both receive the result", async () => {
  const store = new QueryStore();
  const notifications = [0, 0];
  store.subscribe("state", () => notifications[0]++);
  store.subscribe("state", () => notifications[1]++);
  let calls = 0;
  const fetcher = async () => { calls++; return { tournament: "test" }; };
  await Promise.all([store.load("state", fetcher), store.load("state", fetcher)]);
  assert.equal(calls, 1);
  assert.deepEqual(notifications, [2, 2]);
  assert.deepEqual(store.get("state").data, { tournament: "test" });
});

test("null is a successful result, not perpetual loading", async () => {
  const store = new QueryStore();
  await store.load("state", async () => null);
  assert.equal(store.get("state").status, "success");
  assert.equal(store.get("state").data, null);
});

test("errors finish loading and a retry can recover", async () => {
  const store = new QueryStore();
  await store.load("state", async () => { throw Error("RPC unavailable"); });
  assert.equal(store.get("state").status, "error");
  assert.equal(store.get("state").error.message, "RPC unavailable");
  await store.load("state", async () => 42, true);
  assert.equal(store.get("state").status, "success");
  assert.equal(store.get("state").data, 42);
  assert.equal(store.get("state").error, null);
});

test("logout invalidation prevents in-flight data from a previous session reappearing", async () => {
  const store = new QueryStore();
  let release;
  const previous = store.load("state", () => new Promise((resolve) => { release = resolve; }));
  await Promise.resolve();
  store.invalidateAll();
  await store.load("state", async () => "new session");
  release("previous user's private data");
  await previous;
  assert.equal(store.get("state").data, "new session");
});

test("mutation invalidation notifies consumers; unsubscription removes listeners", async () => {
  const store = new QueryStore();
  await store.load("state", async () => 1);
  let notified = 0;
  const unsubscribe = store.subscribe("state", () => notified++);
  store.invalidateAll();
  assert.equal(notified, 1);
  assert.equal(store.get("state").status, "idle");
  unsubscribe();
  store.invalidateAll();
  assert.equal(notified, 1);
});
