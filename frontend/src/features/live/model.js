export const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
export const quantity = (itemId, lots, day = today()) =>
  lots
    .filter(
      (lot) =>
        lot.item_id === itemId &&
        lot.received_date <= day &&
        (!lot.expiry_date || lot.expiry_date >= day),
    )
    .reduce((sum, lot) => sum + lot.qty_on_hand, 0);
export const openRequest = (request) => ["submitted", "approved"].includes(request.status);
export function report(data, start, end) {
  const within = (value) => {
    if (!value) return false;
    const date =
      value.length === 10
        ? value
        : new Date(value).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
    return date >= start && date <= end;
  };
  const donations = data.donations.filter((row) => within(row.received_date));
  const completed = data.requests.filter(
    (row) => row.status === "completed" && within(row.completed_at),
  );
  return {
    donations: donations.length,
    received: data.donationLines
      .filter((row) => donations.some((d) => d.id === row.donation_id))
      .reduce((sum, row) => sum + row.quantity, 0),
    pickups: completed.length,
    distributed: data.pickupLines
      .filter((row) => completed.some((r) => r.id === row.request_id))
      .reduce((sum, row) => sum + row.quantity, 0),
    students: new Set(completed.map((row) => row.student_id)).size,
  };
}
export const emptyData = () => ({
  requests: [],
  slots: [],
  available: [],
  items: [],
  lots: [],
  stock: [],
  profiles: [],
  students: [],
  donations: [],
  donationLines: [],
  pickupLines: [],
  users: [],
  audit: [],
  accessAudit: [],
  idAudit: [],
});
export async function loadWorkspace(api, role) {
  const result = emptyData();
  const sources = { requests: "food_requests", pickupLines: "pickup_lines" };
  if (role !== "student")
    Object.assign(sources, {
      items: "inventory_items",
      lots: "inventory_lots",
      stock: "stock_adjustments",
      profiles: "profiles",
      donations: "donations",
      donationLines: "donation_lines",
      idAudit: "student_id_audit",
    });
  if (role === "admin")
    Object.assign(sources, { audit: "operations_audit", accessAudit: "access_audit" });
  await Promise.all([
    ...Object.entries(sources).map(async ([key, table]) => {
      result[key] = await api.listRecords(table);
    }),
    api.pickupSlots().then((rows) => {
      result.slots = rows;
    }),
    api.availableInventory().then((rows) => {
      result.available = rows;
    }),
    ...(role === "admin"
      ? [
          api.listUsers().then((rows) => {
            result.users = rows;
          }),
        ]
      : []),
    ...(role !== "student"
      ? [
          api.studentDirectory().then((rows) => {
            result.students = rows;
          }),
        ]
      : []),
  ]);
  return result;
}
