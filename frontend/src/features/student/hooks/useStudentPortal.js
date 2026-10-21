import { usePersistedState } from "../../../hooks/usePersistedState.js";
import { initialRequests, initialPickups } from "../../operations/data.js";
import { initialItems } from "../../stock/data/inventory.js";
import { initialSlots } from "../../stock/data/pickupSlots.js";
import { useState, useRef, useEffect } from "react";
import { onHand, slotLabel, dateLabel } from "../utils.js";
import { notifyError } from "../../../components/Notifications.jsx";

export function useStudentPortal({ page, navigate, notify, profile, signOut }) {
  const [requests, setRequests] = usePersistedState("panther-staff-requests", initialRequests);
  const [, setPickups] = usePersistedState("panther-staff-pickups", initialPickups);
  const [ownRequestIds, setOwnRequestIds] = usePersistedState("panther-student-request-ids", []);
  const [inventory] = usePersistedState("panther-inventory-v1", initialItems);
  const [slots, setSlots] = usePersistedState("panther-pickup-slots-v1", initialSlots);
  const [foodId, setFoodId] = useState("");
  const [day, setDay] = useState("");
  const [slotId, setSlotId] = useState("");
  const [note, setNote] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [cancelRequest, setCancelRequest] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const submitting = useRef(false);
  const own = requests.filter(
    (request) => ownRequestIds.includes(request.id) && request.studentId === profile.studentId,
  );
  const open = own.find((request) => ["Waiting", "Approved"].includes(request.status));
  const past = own.filter((request) => !["Waiting", "Approved"].includes(request.status));
  const foods = inventory.filter((item) => item.category !== "Personal care" && onHand(item) > 0);
  const food = foods.find((item) => item.id === foodId);
  // Keep the design's sample calendar in sync with editable staff mock slots.
  const days = [
    ...new Set(slots.filter((slot) => slot.date >= "2026-10-15").map((slot) => slot.date)),
  ].sort();
  const daySlots = slots
    .filter((slot) => slot.date === day)
    .sort((a, b) => a.time.localeCompare(b.time));
  const selectedSlot = daySlots.find((slot) => slot.id === slotId);
  const initials = profile.name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("");
  useEffect(() => {
    setAccountOpen(false);
  }, [page]);

  function chooseFood(value) {
    setFoodId(value);
    setDay("");
    setSlotId("");
  }
  function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    if (open) {
      notifyError("You already have an open request. Cancel it before choosing a new pickup.");
      return;
    }
    if (!food) {
      notifyError("Select an available food item.");
      return;
    }
    if (!selectedSlot || selectedSlot.booked >= selectedSlot.capacity) {
      notifyError("Choose an available pickup day and time.");
      return;
    }
    submitting.current = true;
    const time = slotLabel(selectedSlot);
    const request = {
      id: `student-${crypto.randomUUID()}`,
      name: profile.name,
      studentId: profile.studentId,
      fullPickupDate: dateLabel(day),
      date: day,
      slotId,
      slotReserved: true,
      slot: time,
      time: new Date(`2026-01-01T${selectedSlot.time}:00`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      pickup: `${dateLabel(day)} · ${time}`,
      sent: "Just now",
      status: "Waiting",
      note: note.trim(),
      firstVisit: false,
      foodId: food.id,
      foodName: food.name,
      requestedItems: [{ id: food.id, name: food.name, qty: 1 }],
    };
    setRequests((current) => [request, ...current]);
    setOwnRequestIds((current) => [...current, request.id]);
    setSlots((current) =>
      current.map((slot) => (slot.id === slotId ? { ...slot, booked: slot.booked + 1 } : slot)),
    );
    setSubmitted(request);
    setFoodId("");
    setDay("");
    setSlotId("");
    setNote("");
    navigate("/student/home");
    submitting.current = false;
  }
  function cancel() {
    if (!cancelRequest) return;
    setRequests((current) =>
      current.map((request) =>
        request.id === cancelRequest.id
          ? { ...request, status: "Cancelled", slotReserved: false }
          : request,
      ),
    );
    setPickups((current) => current.filter((pickup) => pickup.id !== cancelRequest.id));
    if (cancelRequest.slotReserved && cancelRequest.slotId) {
      setSlots((current) =>
        current.map((slot) =>
          slot.id === cancelRequest.slotId
            ? { ...slot, booked: Math.max(0, slot.booked - 1) }
            : slot,
        ),
      );
    }
    setCancelRequest(null);
    notify("Your request was cancelled.");
    navigate("/student/home");
  }

  return {
    open,
    setCancelRequest,
    accountOpen,
    setAccountOpen,
    initials,
    inventory,
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
