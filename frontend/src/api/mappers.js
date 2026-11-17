// Pure functions that turn Supabase rows into the shapes the screens use.
import {
  addDays,
  dateTimeLabel,
  dayLabel,
  pantryDate,
  pantryToday,
  sentLabel,
  shortDate,
  slotLabel,
  time24,
  timeLabel,
} from "./time.js";

/** Staff-facing labels; students see "Submitted" for waiting requests. */
export const STATUS_LABELS = {
  submitted: "Waiting",
  approved: "Approved",
  declined: "Declined",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};
export const statusLabel = (status) => STATUS_LABELS[status] || status || "";
export const studentStatusLabel = (status) =>
  status === "submitted" ? "Submitted" : statusLabel(status);

/** Days ahead that count as "expires soon". */
export const EXPIRING_WITHIN_DAYS = 7;

const SAME_IN_PLURAL = new Set(["each", "lb", "lbs", "oz", "kg", "g"]);
/** "can" → "cans", "box" → "boxes"; units already plural or by weight stay as they are. */
export function pluralUnit(unit) {
  const value = String(unit || "").trim();
  if (!value || SAME_IN_PLURAL.has(value.toLowerCase()) || /s$/i.test(value)) return value;
  return /(x|ch|sh)$/i.test(value) ? `${value}es` : `${value}s`;
}
/** "1 can", "3 cans" */
export const quantityText = (quantity, unit) =>
  `${quantity} ${Number(quantity) === 1 ? String(unit || "").trim() : pluralUnit(unit)}`;

export function mapLot(lot, today = pantryToday()) {
  const donors = (lot.donation?.donation_donors || [])
    .map((entry) => entry.donor?.name)
    .filter(Boolean);
  const expired = Boolean(lot.expiry_date && lot.expiry_date < today);
  return {
    id: lot.id,
    quantity: lot.qty_on_hand,
    receivedQuantity: lot.received_quantity,
    expiry: lot.expiry_date,
    received: lot.received_date,
    shelf: lot.storage_location,
    donationId: lot.donation_id,
    source: lot.donation_id
      ? `Donation${donors.length ? ` · ${donors.join(", ")}` : ""}`
      : "Purchased or opening stock",
    expired,
    // Matches the server: only received, unexpired lots with stock can be handed out.
    usable: lot.qty_on_hand > 0 && lot.received_date <= today && !expired,
    expiringSoon:
      lot.qty_on_hand > 0 &&
      Boolean(lot.expiry_date) &&
      !expired &&
      lot.expiry_date <= addDays(today, EXPIRING_WITHIN_DAYS),
  };
}

const byExpiry = (a, b) =>
  (a.expiry || "9999-12-31").localeCompare(b.expiry || "9999-12-31") ||
  (a.received || "").localeCompare(b.received || "");

export function mapInventoryItem(row, today = pantryToday()) {
  const lots = (row.inventory_lots || []).map((lot) => mapLot(lot, today)).sort(byExpiry);
  const usableLots = lots.filter((lot) => lot.usable);
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    unit: pluralUnit(row.unit),
    unitName: row.unit,
    alert: row.low_stock_threshold,
    active: row.active,
    imagePath: row.image_path || null,
    lots,
    onHand: lots.reduce((sum, lot) => sum + Number(lot.quantity), 0),
    available: usableLots.reduce((sum, lot) => sum + Number(lot.quantity), 0),
    nextLot: usableLots[0] || null,
  };
}

export function adjustmentReason(row) {
  if (row.kind === "adjustment") return `Adjustment · ${row.reason}`;
  if (row.kind === "donation") return "Donation";
  if (row.kind === "distribution") return "Distribution";
  return "Opening stock";
}

export const mapAdjustment = (row) => ({
  id: row.id,
  when: dateTimeLabel(row.created_at),
  createdAt: row.created_at,
  change: row.quantity_change,
  after: row.quantity_after,
  kind: row.kind,
  reason: adjustmentReason(row),
  lot: row.lot?.expiry_date
    ? `Expires ${shortDate(row.lot.expiry_date, false)}`
    : "No expiration date",
  by: row.actor?.display_name || "Staff",
});

export const mapSlot = (row) => ({
  id: row.id,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  date: pantryDate(row.starts_at),
  time: time24(row.starts_at),
  label: slotLabel(row.starts_at, row.ends_at),
  capacity: row.capacity,
  booked: row.booked ?? 0,
  remaining: Math.max(0, row.capacity - (row.booked ?? 0)),
});

/** Items handed out, from the server's [{item_id, name, unit, quantity}]. */
export const mapHandedOut = (items) =>
  (items || []).map((item) => ({
    id: item.item_id,
    name: item.name,
    qty: item.quantity,
    unit: item.unit,
    plural: pluralUnit(item.unit),
  }));

function pickupFields(startsAt, endsAt) {
  if (!startsAt) return { date: null, fullPickupDate: "—", slot: "—", time: "", pickup: "—" };
  const date = pantryDate(startsAt);
  return {
    date,
    fullPickupDate: dayLabel(date),
    slot: slotLabel(startsAt, endsAt),
    time: timeLabel(startsAt),
    pickup: `${dayLabel(date)} · ${timeLabel(startsAt)}`,
  };
}

export const mapMyRequest = (row) => ({
  id: row.id,
  dbStatus: row.status,
  status: statusLabel(row.status),
  studentStatus: studentStatusLabel(row.status),
  foodName: row.item_name || (row.categories || []).join(", "),
  note: row.pickup_note || "",
  declineReason: row.decline_reason || "",
  createdAt: row.created_at,
  completedAt: row.completed_at,
  items: mapHandedOut(row.items),
  slotId: row.slot_id,
  ...pickupFields(row.slot_starts_at, row.slot_ends_at),
});

export const mapStaffRequest = (row, now = new Date()) => ({
  id: row.id,
  dbStatus: row.status,
  status: statusLabel(row.status),
  name: row.student_name || "Student",
  studentId: row.student_id || "",
  idVerified: row.id_verified,
  firstVisit: row.first_visit,
  profileId: row.profile_id,
  slotId: row.slot_id,
  foodName: row.item_name || (row.categories || []).join(", "),
  note: row.pickup_note || "",
  declineReason: row.decline_reason || "",
  decidedBy: row.decided_by_name || "",
  sent: sentLabel(row.created_at, now),
  createdAt: row.created_at,
  items: mapHandedOut(row.items),
  ...pickupFields(row.slot_starts_at, row.slot_ends_at),
});

/** No-show can be recorded 30 minutes after the slot ends (the server enforces the same rule). */
export const NO_SHOW_GRACE_MINUTES = 30;

export function mapPickup(row, now = new Date()) {
  const walkIn = !row.request_id;
  const noShowAfter = row.slot_ends_at
    ? new Date(new Date(row.slot_ends_at).getTime() + NO_SHOW_GRACE_MINUTES * 60000)
    : null;
  const fields = walkIn
    ? {
        date: pantryDate(row.distributed_at),
        fullPickupDate: dayLabel(pantryDate(row.distributed_at)),
        slot: null,
        time: "Walk-in",
        pickup: "Walk-in",
      }
    : pickupFields(row.slot_starts_at, row.slot_ends_at);
  return {
    id: row.request_id || row.distribution_id,
    requestId: row.request_id,
    distributionId: row.distribution_id,
    kind: row.kind,
    recipientId: row.recipient_id,
    name: row.student_name || "Student",
    studentId: row.student_id || "",
    idVerified: row.id_verified,
    firstVisit: row.first_visit,
    dbStatus: row.status,
    status: statusLabel(row.status),
    slotId: row.slot_id,
    slotStartsAt: row.slot_starts_at,
    capacity: row.slot_capacity,
    booked: row.slot_booked,
    note: row.pickup_note || "",
    foodName: row.item_name || "",
    itemId: row.item_id || null,
    pickedUp: row.distributed_at ? timeLabel(row.distributed_at) : null,
    items: mapHandedOut(row.items),
    noShowAt: noShowAfter ? timeLabel(noShowAfter) : null,
    noShowAllowed: Boolean(noShowAfter && row.status === "approved" && now >= noShowAfter),
    ...fields,
  };
}

export const mapStudent = (row) => ({
  kind: row.kind,
  id: row.id,
  studentId: row.student_id || "",
  name: row.full_name || "Student",
  provisional: row.kind === "provisional",
  idVerified: row.id_verified,
  checked: row.id_checked_at ? shortDate(pantryDate(row.id_checked_at), false) : "",
  lastPickup: row.last_pickup_at ? shortDate(pantryDate(row.last_pickup_at), false) : "—",
  // Only a request that is still open (waiting or approved) is shown.
  request: ["submitted", "approved"].includes(row.latest_request_status)
    ? studentStatusLabel(row.latest_request_status)
    : "",
  active: row.enabled,
});

export function mapDonation(row) {
  const donors = (row.donation_donors || []).map((entry) => entry.donor?.name).filter(Boolean);
  const lots = row.inventory_lots || [];
  return {
    id: row.id,
    received: row.received_on,
    donors,
    donor: donors.join(", "),
    lines: lots.length,
    units: lots.reduce((sum, lot) => sum + Number(lot.received_quantity || 0), 0),
    recordedBy: row.recorder?.display_name || "",
    details: lots.map((lot) => ({
      id: lot.id,
      name: lot.item?.name || "Item",
      quantity: lot.received_quantity,
      unit: lot.item?.unit || "",
      imagePath: lot.item?.image_path || null,
      expiry: lot.expiry_date,
      shelf: lot.storage_location,
    })),
  };
}

export const mapAccount = (row) => ({
  id: row.user_id,
  name: row.display_name || row.email,
  email: row.email,
  studentId: row.student_id || row.claimed_student_id || "",
  studentIdVerified: Boolean(row.student_id),
  role: row.role,
  active: row.enabled,
  lastSignIn: row.last_sign_in_at,
  createdAt: row.created_at,
});

export const mapAuditEntry = (row) => ({
  id: row.id,
  timestamp: row.created_at,
  actor: row.actor,
  action: row.action,
  record: row.record,
  change: row.change,
});
