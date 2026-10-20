import { test } from "node:test";
import assert from "node:assert/strict";
import { distributeInventory } from "../src/features/operations/utils/distributeInventory.js";
import { pickupDate, pickupSlot } from "../src/features/operations/utils/pickupDates.js";
import { initialPickups, initialRequests } from "../src/features/operations/data.js";

function inventoryFixture() {
  return [
    {
      id: "rice",
      name: "Rice",
      unit: "bags",
      lots: [
        { id: "later", quantity: 4, expiry: "2027-02-01" },
        { id: "earlier", quantity: 2, expiry: "2026-11-01" },
        { id: "undated", quantity: 3, expiry: "" },
      ],
      changes: [],
    },
    { id: "beans", name: "Beans", unit: "cans", lots: [], changes: [] },
  ];
}

test("distribution consumes the earliest-expiring lots without changing the source inventory", () => {
  const inventory = inventoryFixture();
  const original = structuredClone(inventory);
  const updated = distributeInventory(
    inventory,
    [{ id: "rice", name: "Rice", qty: 3 }],
    "pickup-1",
    "Oct 20, 1:00 PM",
  );

  assert.deepEqual(inventory, original);
  assert.deepEqual(
    updated[0].lots.map((lot) => [lot.id, lot.quantity]),
    [
      ["later", 3],
      ["earlier", 0],
      ["undated", 3],
    ],
  );
  assert.equal(
    updated[0].changes.reduce((sum, change) => sum + change.change, 0),
    -3,
  );
  assert.ok(updated[0].changes.every((change) => change.pickupId === "pickup-1"));
  assert.equal(updated[1], inventory[1]);
});

test("invalid or insufficient quantities cannot leave partially updated stock", () => {
  const inventory = inventoryFixture();
  const original = structuredClone(inventory);
  for (const qty of [0, -1, 1.5]) {
    assert.throws(
      () => distributeInventory(inventory, [{ id: "rice", name: "Rice", qty }], "p", "now"),
      /whole-number quantity/,
    );
  }
  assert.throws(
    () =>
      distributeInventory(
        inventory,
        [
          { id: "rice", name: "Rice", qty: 1 },
          { id: "beans", name: "Beans", qty: 1 },
        ],
        "p",
        "now",
      ),
    /Only 0 cans/,
  );
  assert.deepEqual(inventory, original);
});

test("a completed pickup cannot deduct its stock a second time", () => {
  const selection = [{ id: "rice", name: "Rice", qty: 1 }];
  const once = distributeInventory(inventoryFixture(), selection, "pickup-1", "now");
  const original = structuredClone(once);
  assert.throws(
    () => distributeInventory(once, selection, "pickup-1", "now"),
    /already been recorded/,
  );
  assert.deepEqual(once, original);
});

test("pickup dates support stored dates and the original design fixtures", () => {
  assert.equal(pickupDate({ date: "2026-12-01", pickup: "Thu, Oct 15 · 11:00 AM" }), "2026-12-01");
  assert.equal(pickupDate(initialRequests.find((request) => request.id === "noah")), "2026-10-15");
  assert.equal(pickupDate(initialPickups[0]), "2026-10-14");
  assert.equal(pickupSlot({ time: "11:30 AM" }), "11:30 – 12:00 PM");
  assert.equal(pickupSlot({ slot: "Walk-in" }), "Walk-in");
});
