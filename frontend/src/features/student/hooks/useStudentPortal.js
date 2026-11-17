import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { affected, keys } from "../../../api/keys.js";
import {
  cancelRequest as cancelOwnRequest,
  fetchMyRequests,
  submitRequest,
} from "../../../api/requests.js";
import { fetchAvailableFoods, fetchCategoryAvailability } from "../../../api/inventory.js";
import { fetchSlots } from "../../../api/operations.js";
import { addDays, dayLabel, pantryToday } from "../../../api/time.js";
import { useRefresh } from "../../../lib/queryClient.js";
import { notifyError } from "../../../components/Notifications.jsx";

// Students can book pickups this many days ahead.
const BOOKING_WINDOW_DAYS = 30;
const OPEN_STATUSES = ["submitted", "approved"];
// Personal-care products are handed out at the desk, not requested.
export const REQUESTABLE = (item) => item.category !== "Personal care";

export function useStudentPortal({ page, navigate, notify, profile }) {
  const refresh = useRefresh();
  const today = pantryToday();
  const lastDay = addDays(today, BOOKING_WINDOW_DAYS);
  const requestsQuery = useQuery({ queryKey: keys.myRequests, queryFn: fetchMyRequests });
  const foodsQuery = useQuery({
    queryKey: keys.foods,
    queryFn: fetchAvailableFoods,
    enabled: page === "request",
  });
  const availabilityQuery = useQuery({
    queryKey: keys.categoryAvailability,
    queryFn: fetchCategoryAvailability,
    enabled: page === "home",
  });
  const [foodId, setFoodId] = useState("");
  const slotsQuery = useQuery({
    queryKey: keys.slots(today, lastDay),
    queryFn: () => fetchSlots(today, lastDay),
    enabled: page === "request" && Boolean(foodId),
  });
  const [day, setDay] = useState("");
  const [slotId, setSlotId] = useState("");
  const [note, setNote] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [cancelRequest, setCancelRequest] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const requests = requestsQuery.data || [];
  const open = requests.find((request) => OPEN_STATUSES.includes(request.dbStatus));
  const past = requests.filter((request) => !OPEN_STATUSES.includes(request.dbStatus));
  const foods = (foodsQuery.data || []).filter(REQUESTABLE);
  const food = foods.find((item) => item.id === foodId);
  const now = Date.now();
  const upcoming = (slotsQuery.data || []).filter((slot) => Date.parse(slot.startsAt) > now);
  const days = [...new Set(upcoming.map((slot) => slot.date))].sort();
  const daySlots = upcoming.filter((slot) => slot.date === day);
  const selectedSlot = daySlots.find((slot) => slot.id === slotId);
  const availability = (availabilityQuery.data || []).filter(REQUESTABLE);
  useEffect(() => {
    setAccountOpen(false);
  }, [page]);

  function chooseFood(value) {
    setFoodId(value);
    setDay("");
    setSlotId("");
  }
  async function submit(event) {
    event.preventDefault();
    if (open) {
      notifyError("You already have an open request. Cancel it before choosing a new pickup.");
      return;
    }
    if (!food) {
      notifyError("Select an available food item.");
      return;
    }
    if (!selectedSlot || selectedSlot.remaining < 1) {
      notifyError("Choose an available pickup day and time.");
      return;
    }
    try {
      await submitRequest({ slotId: selectedSlot.id, itemId: food.id, note: note.trim() });
    } catch (error) {
      // The slot may have filled or the item run out since this page loaded.
      await refresh([["slots"], keys.foods]);
      throw error;
    }
    await refresh(affected.request);
    setSubmitted({ foodName: food.name, fullPickupDate: dayLabel(day), slot: selectedSlot.label });
    setFoodId("");
    setDay("");
    setSlotId("");
    setNote("");
    navigate("/student/home");
  }
  async function cancel() {
    if (!cancelRequest) return;
    await cancelOwnRequest(cancelRequest.id);
    await refresh(affected.request);
    setCancelRequest(null);
    notify("Your request was cancelled.");
    navigate("/student/home");
  }

  return {
    queries: {
      requests: requestsQuery,
      foods: foodsQuery,
      slots: slotsQuery,
      availability: availabilityQuery,
    },
    open,
    setCancelRequest,
    accountOpen,
    setAccountOpen,
    availability,
    submit,
    foodId,
    chooseFood,
    foods,
    food,
    days,
    day,
    setDay,
    setSlotId,
    daySlots,
    slotId,
    note,
    setNote,
    selectedSlot,
    past,
    cancelRequest,
    cancel,
    submitted,
    setSubmitted,
  };
}
