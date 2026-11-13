import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  dayLabel,
  pantryDate,
  sentLabel,
  slotLabel,
  time24,
  timeLabel,
} from "../src/api/time.js";
import {
  mapDonation,
  mapInventoryItem,
  mapMyRequest,
  mapPickup,
  mapSlot,
  mapStaffRequest,
  mapStudent,
  pluralUnit,
  quantityText,
} from "../src/api/mappers.js";
import { toUserError } from "../src/api/errors.js";
import { unitOptions, units } from "../src/features/stock/units.js";

// 15:30 UTC on Nov 9, 2026 is 9:30 AM in Chicago (CST, UTC-6).
const at = (iso) => new Date(iso).toISOString();

test("times and dates display in pantry (Chicago) time", () => {
  assert.equal(timeLabel(at("2026-11-09T15:30:00Z")), "9:30 AM");
  assert.equal(time24(at("2026-11-09T19:30:00Z")), "13:30");
  // 03:00 UTC on Nov 10 is still Nov 9 in Chicago.
  assert.equal(pantryDate(at("2026-11-10T03:00:00Z")), "2026-11-09");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(dayLabel("2026-11-09"), "Mon, Nov 9");
});

test("slot labels drop the repeated period and keep it when it changes", () => {
  assert.equal(
    slotLabel(at("2026-11-09T16:00:00Z"), at("2026-11-09T16:30:00Z")),
    "10:00 – 10:30 AM",
  );
  assert.equal(
    slotLabel(at("2026-11-09T17:30:00Z"), at("2026-11-09T18:00:00Z")),
    "11:30 AM – 12:00 PM",
  );
});

test("sent labels say today or yesterday in pantry time", () => {
  const now = new Date("2026-11-09T20:00:00Z");
  assert.equal(sentLabel(at("2026-11-09T15:12:00Z"), now), "Today, 9:12 AM");
  assert.equal(sentLabel(at("2026-11-09T01:30:00Z"), now), "Yesterday, 7:30 PM");
  assert.equal(sentLabel(at("2026-11-05T15:00:00Z"), now), "Nov 5, 9:00 AM");
});

test("units are pluralized for display", () => {
  assert.equal(pluralUnit("can"), "cans");
  assert.equal(pluralUnit("box"), "boxes");
  assert.equal(pluralUnit("lb"), "lb");
  assert.equal(pluralUnit("cans"), "cans");
  assert.equal(quantityText(1, "jar"), "1 jar");
  assert.equal(quantityText(3, "jar"), "3 jars");
});

test("inventory counts only usable lots and picks the soonest-expiring one next", () => {
  const lot = (id, qty, expiry, received = "2026-10-01") => ({
    id,
    qty_on_hand: qty,
    expiry_date: expiry,
    received_date: received,
    storage_location: "A1",
    received_quantity: qty,
    donation_id: null,
  });
  const item = mapInventoryItem(
    {
      id: "beans",
      name: "Canned beans",
      category: "Canned goods",
      unit: "can",
      active: true,
      low_stock_threshold: 10,
      image_path: "beans/photo.webp",
      inventory_lots: [
        lot("later", 6, "2027-01-01"),
        lot("expired", 7, "2026-11-01"),
        lot("soon", 2, "2026-11-12"),
        lot("future", 9, "2027-02-01", "2026-12-01"),
        lot("empty", 0, "2026-11-10"),
      ],
    },
    "2026-11-09",
  );
  assert.equal(item.unit, "cans");
  assert.equal(item.imagePath, "beans/photo.webp");
  assert.equal(item.available, 8, "expired, empty, and not-yet-received lots are excluded");
  assert.equal(item.onHand, 24);
  assert.equal(item.nextLot.id, "soon");
  assert.deepEqual(
    item.lots.filter((l) => l.expiringSoon).map((l) => l.id),
    ["soon"],
  );
  assert.ok(item.lots.find((l) => l.id === "expired").expired);
});

test("pickups distinguish requests from walk-ins and time the no-show rule", () => {
  const base = {
    distribution_id: null,
    kind: "account",
    recipient_id: "p1",
    student_name: "Stu One",
    student_id: "P00000001",
    id_verified: false,
    first_visit: true,
    status: "approved",
    slot_id: "s1",
    slot_starts_at: at("2026-11-09T19:00:00Z"),
    slot_ends_at: at("2026-11-09T19:30:00Z"),
    slot_capacity: 5,
    slot_booked: 2,
    pickup_note: "",
    item_name: "Rice",
    item_id: "i1",
    distributed_at: null,
    items: [],
  };
  const pickup = mapPickup({ ...base, request_id: "r1" }, new Date("2026-11-09T19:59:00Z"));
  assert.equal(pickup.itemId, "i1", "the requested food's id is kept for the hand-out list");
  assert.equal(pickup.slot, "1:00 – 1:30 PM");
  assert.equal(pickup.noShowAt, "2:00 PM");
  assert.equal(pickup.noShowAllowed, false);
  assert.equal(
    mapPickup({ ...base, request_id: "r1" }, new Date("2026-11-09T20:00:00Z")).noShowAllowed,
    true,
  );

  const walkIn = mapPickup(
    {
      ...base,
      request_id: null,
      distribution_id: "d1",
      kind: "provisional",
      status: "completed",
      slot_id: null,
      slot_starts_at: null,
      slot_ends_at: null,
      distributed_at: at("2026-11-09T16:05:00Z"),
      items: [{ item_id: "i1", name: "Rice", unit: "bag", quantity: 2 }],
    },
    new Date("2026-11-09T20:00:00Z"),
  );
  assert.equal(walkIn.id, "d1");
  assert.equal(walkIn.time, "Walk-in");
  assert.equal(walkIn.slot, null);
  assert.equal(walkIn.pickedUp, "10:05 AM");
  assert.equal(walkIn.noShowAllowed, false);
  assert.deepEqual(walkIn.items[0], {
    id: "i1",
    name: "Rice",
    qty: 2,
    unit: "bag",
    plural: "bags",
  });
});

test("request statuses read as Waiting for staff and Submitted for students", () => {
  const row = {
    id: "r1",
    status: "submitted",
    created_at: at("2026-11-09T15:00:00Z"),
    slot_id: "s1",
    slot_starts_at: at("2026-11-10T16:00:00Z"),
    slot_ends_at: at("2026-11-10T16:30:00Z"),
    item_name: null,
    categories: ["Protein"],
    pickup_note: "No pork",
    decline_reason: null,
    items: [],
  };
  const staff = mapStaffRequest({ ...row, student_name: "Stu", student_id: "P1" });
  assert.equal(staff.status, "Waiting");
  assert.equal(staff.pickup, "Tue, Nov 10 · 10:00 AM");
  assert.equal(staff.foodName, "Protein", "falls back to the requested category");
  const mine = mapMyRequest(row);
  assert.equal(mine.studentStatus, "Submitted");
  assert.equal(mine.fullPickupDate, "Tue, Nov 10");
  assert.equal(mapMyRequest({ ...row, status: "no_show" }).status, "No-show");
});

test("slots report remaining capacity", () => {
  const slot = mapSlot({
    id: "s1",
    starts_at: at("2026-11-10T16:00:00Z"),
    ends_at: at("2026-11-10T16:30:00Z"),
    capacity: 3,
    booked: 3,
  });
  assert.equal(slot.date, "2026-11-10");
  assert.equal(slot.time, "10:00");
  assert.equal(slot.remaining, 0);
});

test("the student directory only shows requests that are still open", () => {
  const row = {
    kind: "account",
    id: "p1",
    full_name: "Stu",
    student_id: "P00000001",
    id_verified: false,
    id_checked_at: null,
    enabled: true,
    last_pickup_at: null,
  };
  assert.equal(mapStudent({ ...row, latest_request_status: "submitted" }).request, "Submitted");
  assert.equal(mapStudent({ ...row, latest_request_status: "completed" }).request, "");
  assert.equal(mapStudent({ ...row, latest_request_status: null }).lastPickup, "—");
});

test("donations total the received quantity of their lots", () => {
  const donation = mapDonation({
    id: "d1",
    received_on: "2026-11-02",
    donation_donors: [{ donor: { name: "Northside Church" } }, { donor: { name: "Alumni drive" } }],
    inventory_lots: [
      {
        id: "l1",
        received_quantity: 5,
        expiry_date: "2027-01-01",
        storage_location: "A4",
        item: { name: "Beans", unit: "can", image_path: null },
      },
      {
        id: "l2",
        received_quantity: 2,
        expiry_date: null,
        storage_location: "B2",
        item: { name: "Rice", unit: "bag", image_path: "item-1/photo.webp" },
      },
    ],
  });
  assert.equal(donation.donor, "Northside Church, Alumni drive");
  assert.equal(donation.lines, 2);
  assert.equal(donation.units, 7);
  assert.deepEqual(
    donation.details.map((line) => line.imagePath),
    [null, "item-1/photo.webp"],
  );
});

test("the fixed units read correctly as plurals and keep an item's unlisted unit", () => {
  assert.deepEqual(units.map(pluralUnit), [
    "cans",
    "jars",
    "bottles",
    "cartons",
    "boxes",
    "bags",
    "canisters",
    "packs",
    "bars",
    "tubes",
    "pouches",
    "each",
  ]);
  assert.equal(new Set(units).size, units.length);
  assert.equal(unitOptions("can"), units);
  assert.deepEqual(unitOptions("sack").slice(-1), ["sack"]);
});

test("errors keep database messages and hide internal wording", () => {
  assert.equal(
    toUserError({ code: "23514", message: "This pickup time is full. Choose another time." })
      .message,
    "This pickup time is full. Choose another time.",
  );
  const silence = console.error;
  console.error = () => {};
  try {
    assert.match(
      toUserError({ name: "TypeError", message: "Failed to fetch" }).message,
      /couldn't reach/,
    );
    assert.match(
      toUserError({ code: "42501", message: "permission denied for table x" }).message,
      /doesn't have access/,
    );
    assert.match(
      toUserError({ code: "23502", message: 'null value violates not-null constraint "x"' })
        .message,
      /went wrong saving/,
    );
    assert.match(
      toUserError({ code: "PGRST301", message: "JWT expired" }).message,
      /session has expired/,
    );
  } finally {
    console.error = silence;
  }
});
