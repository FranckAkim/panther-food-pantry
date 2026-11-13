import { rpc } from "./client.js";
import { mapMyRequest, mapPickup, mapStaffRequest } from "./mappers.js";

// Students
export const fetchMyRequests = async () => (await rpc("my_food_requests")).map(mapMyRequest);

export const submitRequest = ({ slotId, itemId, note }) =>
  rpc("submit_food_request", { p_slot_id: slotId, p_item_id: itemId, p_note: note || "" });

export const cancelRequest = (requestId) => rpc("cancel_food_request", { p_request_id: requestId });

// Staff
export const fetchStaffRequests = async () => {
  const now = new Date();
  return (await rpc("staff_list_requests")).map((row) => mapStaffRequest(row, now));
};

export const decideRequest = (requestId, approve, reason) =>
  rpc("staff_decide_request", {
    p_request_id: requestId,
    p_approve: approve,
    p_reason: reason || null,
  });

export const markNoShow = (requestId) => rpc("staff_mark_no_show", { p_request_id: requestId });

export const fetchPickups = async (date) => {
  const now = new Date();
  return (await rpc("staff_pickups", { p_date: date })).map((row) => mapPickup(row, now));
};

/**
 * Hands out food for an approved request ({ requestId }) or a walk-in
 * ({ profileId } or { provisionalStudentId }). items: [{ id, qty }].
 */
export const completeDistribution = ({
  requestId = null,
  profileId = null,
  provisionalStudentId = null,
  items,
  idChecked,
}) =>
  rpc("staff_complete_distribution", {
    p_request_id: requestId,
    p_profile_id: profileId,
    p_provisional_student_id: provisionalStudentId,
    p_items: items.map((item) => ({ item_id: item.id, quantity: item.qty })),
    p_id_checked: Boolean(idChecked),
  });
