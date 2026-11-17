// Pickup slots, the student directory, walk-ins, donations, and admin data.
import { rpc, run, supabase } from "./client.js";
import { mapAccount, mapAuditEntry, mapDonation, mapSlot, mapStudent } from "./mappers.js";

// Pickup slots ------------------------------------------------------------------
export const fetchSlots = async (from, to) =>
  (await rpc("pickup_slot_availability", { p_from: from, p_to: to })).map(mapSlot);

export const createSlots = async ({ date, start, end, interval, capacity }) =>
  (
    await rpc("staff_create_pickup_slots", {
      p_date: date,
      p_start: start,
      p_end: end,
      p_interval_minutes: interval,
      p_capacity: capacity,
    })
  ).length;

export const updateSlotCapacity = (slotId, capacity) =>
  rpc("staff_update_pickup_slot", { p_slot_id: slotId, p_capacity: capacity });

// Students and walk-ins -----------------------------------------------------------
export const fetchStudents = async () => (await rpc("staff_list_students")).map(mapStudent);

/** Looks up a student by ID number; returns the match or null. */
export async function findStudent(studentId) {
  const [row] = await rpc("staff_find_student", { p_student_id: studentId });
  return row
    ? {
        kind: row.kind,
        id: row.id,
        name: row.full_name,
        studentId: row.student_id,
        idVerified: row.id_verified,
        firstVisit: !row.has_pickups,
      }
    : null;
}

export const createProvisionalStudent = ({ studentId, name, idChecked }) =>
  rpc("staff_create_provisional_student", {
    p_student_id: studentId,
    p_full_name: name,
    p_id_checked: Boolean(idChecked),
  });

/** Records that staff checked the student's ID card. */
export const verifyStudentId = (student) =>
  student.kind === "provisional"
    ? rpc("staff_check_provisional_id", { p_provisional_student_id: student.id })
    : rpc("staff_set_student_id", {
        target: student.id,
        new_student_id: student.studentId,
        identification_checked: true,
      });

// Donations ---------------------------------------------------------------------
export const fetchDonors = async () =>
  (await run(supabase.from("donors").select("name").order("name"))).map((donor) => donor.name);

export async function fetchDonations() {
  const rows = await run(
    supabase
      .from("donations")
      .select(
        `id, received_on, created_at, recorder:profiles(display_name),
         donation_donors(donor:donors(name)),
         inventory_lots(id, received_quantity, expiry_date, storage_location,
           item:inventory_items(name, unit, image_path))`,
      )
      .order("received_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
  );
  return rows.map(mapDonation);
}

/**
 * lines: [{ itemId, quantity, expiry, shelf }], or for an item not in the inventory yet,
 * [{ newItem: { name, category, unit, alert }, quantity, expiry, shelf }]. New items are created
 * in the same database call as the donation. Returns the donation row.
 */
export const recordDonation = ({ received, donors, lines }) =>
  rpc("staff_record_donation", {
    p_received_on: received,
    p_donors: donors,
    p_lines: lines.map((line) => ({
      ...(line.newItem
        ? {
            new_item: {
              name: line.newItem.name,
              category: line.newItem.category,
              unit: line.newItem.unit,
              low_stock_threshold: line.newItem.alert,
            },
          }
        : { item_id: line.itemId }),
      quantity: Number(line.quantity),
      expiry_date: line.expiry || null,
      storage_location: line.shelf,
    })),
  });

/** Staff: ids of the items in a donation, keyed by lower-case name (finds items it created). */
export async function donationItemIds(donationId) {
  const lots = await run(
    supabase
      .from("inventory_lots")
      .select("item:inventory_items(id, name)")
      .eq("donation_id", donationId),
  );
  return new Map(lots.map((lot) => [lot.item.name.toLowerCase(), lot.item.id]));
}

// Admin ---------------------------------------------------------------------------
export const fetchAccounts = async () => (await rpc("admin_list_accounts")).map(mapAccount);

export const setAccess = (userId, role, enabled) =>
  rpc("admin_set_access", { target_user_id: userId, new_role: role, new_enabled: enabled });

export const fetchReportMonths = () => rpc("admin_report_months");

export const fetchReport = (month) => rpc("admin_monthly_report", { p_month: `${month}-01` });

export const fetchAuditEntries = async () => (await rpc("admin_audit_entries")).map(mapAuditEntry);
