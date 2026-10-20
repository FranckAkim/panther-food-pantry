import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { eventName, persistMockValue, readMockValue } from "../src/lib/mockStorage.js";
import { waitForMockResponse } from "../src/lib/mockLatency.js";

beforeEach(() => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  globalThis.window = new EventTarget();
});

test("mock writes persist records and announce the changed key to subscribers", () => {
  let changedKey;
  window.addEventListener(eventName, (event) => {
    changedKey = event.detail.key;
  });
  const value = [{ id: "donation", donors: ["Alumni", "Community"], units: 12 }];
  persistMockValue("storage-test-donations", value);
  assert.equal(changedKey, "storage-test-donations");
  assert.deepEqual(JSON.parse(localStorage.getItem(changedKey)), value);
  assert.deepEqual(readMockValue(changedKey, []), value);
});

test("the session remains usable when browser storage is unavailable or contains invalid JSON", () => {
  globalThis.localStorage = {
    getItem() {
      throw new Error("Storage unavailable");
    },
    setItem() {
      throw new Error("Storage unavailable");
    },
  };
  persistMockValue("storage-test-fallback", { name: "Sample student" });
  assert.deepEqual(readMockValue("storage-test-fallback", null), { name: "Sample student" });
  assert.equal(readMockValue("storage-test-missing", "fallback"), "fallback");
  globalThis.localStorage = { getItem: () => "{invalid" };
  assert.deepEqual(readMockValue("storage-test-fallback", null), { name: "Sample student" });
});

test("mock requests can be cancelled before or while awaiting a response", async () => {
  const controller = new AbortController();
  const pending = waitForMockResponse(1000, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  await assert.rejects(waitForMockResponse(1000, controller.signal), { name: "AbortError" });
  await waitForMockResponse(0);
});
