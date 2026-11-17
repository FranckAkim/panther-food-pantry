import test from "node:test";
import assert from "node:assert/strict";
import { quantity, report, emptyData, loadWorkspace } from "../src/features/live/model.js";

test("connected availability excludes expired and future lots", () => {
  assert.equal(
    quantity(
      "a",
      [
        { item_id: "a", qty_on_hand: 3, received_date: "2026-11-01", expiry_date: null },
        { item_id: "a", qty_on_hand: 7, received_date: "2026-11-01", expiry_date: "2026-11-16" },
        { item_id: "a", qty_on_hand: 9, received_date: "2026-11-18", expiry_date: null },
        { item_id: "b", qty_on_hand: 5, received_date: "2026-11-01", expiry_date: null },
      ],
      "2026-11-17",
    ),
    3,
  );
});
test("reports reconcile received and distributed lines only in the selected period", () => {
  const data = emptyData();
  data.donations = [
    { id: "d", received_date: "2026-11-01" },
    { id: "old", received_date: "2026-10-01" },
  ];
  data.donationLines = [
    { donation_id: "d", quantity: 4 },
    { donation_id: "old", quantity: 9 },
  ];
  data.requests = [
    { id: "r", student_id: "s", status: "completed", completed_at: "2026-11-02T12:00:00Z" },
    { id: "pending", student_id: "s", status: "approved" },
  ];
  data.pickupLines = [
    { request_id: "r", quantity: 2 },
    { request_id: "pending", quantity: 8 },
  ];
  assert.deepEqual(report(data, "2026-11-01", "2026-11-30"), {
    donations: 1,
    received: 4,
    pickups: 1,
    distributed: 2,
    students: 1,
  });
});
test("student loading never queries staff or administrator tables", async () => {
  const queried = [];
  const api = {
    listRecords: async (table) => {
      queried.push(table);
      return [];
    },
    pickupSlots: async () => [],
    availableInventory: async () => [],
  };
  await loadWorkspace(api, "student");
  assert.deepEqual(queried, ["food_requests", "pickup_lines"]);
});
test("reports use the pantry's Central date at UTC midnight", () => {
  const data = emptyData();
  data.requests = [
    { id: "r", student_id: "s", status: "completed", completed_at: "2026-11-18T01:00:00Z" },
  ];
  data.pickupLines = [{ request_id: "r", quantity: 1 }];
  assert.equal(report(data, "2026-11-17", "2026-11-17").distributed, 1);
  assert.equal(report(data, "2026-11-18", "2026-11-18").distributed, 0);
});
