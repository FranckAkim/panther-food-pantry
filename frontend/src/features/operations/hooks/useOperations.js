// Keep workflow state here so page navigation preserves filters and selections.
import { usePendingAction } from "../../../components/loading/ActionContext.js";
import { usePersistedState } from "../../../hooks/usePersistedState.js";
import { initialRequests, initialPickups, waitingRequests, foodCatalog } from "../data.js";
import { initialItems } from "../../stock/data/inventory.js";
import { initialSlots } from "../../stock/data/pickupSlots.js";
import { useState, useMemo, useEffect } from "react";
import { readActivePickup, readSaved } from "../storage.js";
import { pickupDate, pickupSlot } from "../utils/pickupDates.js";
import { notifyError } from "../../../components/Notifications.jsx";
import { distributeInventory } from "../utils/distributeInventory.js";

export function useOperations({ page, navigate, notify }) {
  const { pending } = usePendingAction();
  const [requests, setRequests] = usePersistedState("panther-staff-requests", initialRequests);
  const [pickups, setPickups] = usePersistedState("panther-staff-pickups", initialPickups);
  const [inventory, setInventory] = usePersistedState("panther-inventory-v1", initialItems);
  const [, setSlots] = usePersistedState("panther-pickup-slots-v1", initialSlots);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Waiting");
  const [declining, setDeclining] = useState(null);
  const [reason, setReason] = useState("");
  const [selectedRequest, setSelectedRequest] = usePersistedState(
    "panther-selected-request",
    waitingRequests[0].id,
  );
  const [selectedPickup, setSelectedPickup] = useState(readActivePickup);
  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [idChecked, setIdChecked] = useState(true);
  const [dayOffset, setDayOffset] = usePersistedState("panther-pickup-day", 0);
  const [noShowPickup, setNoShowPickup] = useState(null);
  const waitingCount = requests.filter((r) => r.status === "Waiting").length;
  const approvedCount = requests.filter((r) => r.status === "Approved").length;
  const selectedDate = new Date(Date.UTC(2026, 9, 14 + dayOffset, 12)).toISOString().slice(0, 10);
  const dayPickups = pickups.filter((pickup) => pickupDate(pickup) === selectedDate);
  const dashboardPickups = pickups.filter((pickup) => pickupDate(pickup) === "2026-10-14");
  const doneCount = dayPickups.filter((p) => p.status === "Completed").length;
  const pendingCount = dayPickups.filter((p) => p.status === "Approved").length;
  const availableCatalog = useMemo(
    () =>
      inventory.map((item) => {
        const firstLot = [...item.lots]
          .filter((lot) => Number(lot.quantity) > 0)
          .sort((a, b) => (a.expiry || "9999").localeCompare(b.expiry || "9999"))[0];
        const known = foodCatalog.find((candidate) => candidate.id === item.id);
        return {
          id: item.id,
          name: item.name,
          unit: known?.unit || item.unit.replace(/s$/, ""),
          plural: item.unit,
          qty: known?.qty || 1,
          onHand: item.lots.reduce((sum, lot) => sum + Number(lot.quantity), 0),
          expires: firstLot?.expiry
            ? new Date(`${firstLot.expiry}T12:00:00`).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "—",
          shelf: firstLot?.shelf === "Cooler" ? "Cooler" : `Shelf ${firstLot?.shelf || "—"}`,
          expiring: firstLot?.expiry && firstLot.expiry <= "2026-10-21",
        };
      }),
    [inventory],
  );
  const displayedItems = items.map((item) => ({
    ...item,
    ...availableCatalog.find((candidate) => candidate.id === item.id),
    qty: item.qty,
  }));
  const lowStockItems = inventory.filter(
    (item) => item.lots.reduce((sum, lot) => sum + Number(lot.quantity), 0) < item.alert,
  );
  const expiringLots = inventory.flatMap((item) =>
    item.lots
      .filter((lot) => Number(lot.quantity) > 0 && lot.expiry && lot.expiry <= "2026-10-21")
      .map((lot) => ({ ...lot, itemName: item.name, unit: item.unit })),
  );
  const activeRequest = requests.find((r) => r.id === selectedRequest) || requests[0];
  const filteredRequests = useMemo(
    () =>
      requests.filter(
        (r) =>
          (filter === "All" || r.status === filter) &&
          `${r.name} ${r.studentId}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [requests, filter, search],
  );

  useEffect(() => {
    if (page === "distribution") {
      const active = readActivePickup();
      setSelectedPickup(active);
      setIdChecked(!active.firstVisit || active.idChecked === true || active.id === "marcus");
      setItems([]);
      setItemId("");
      setQuantity(1);
    }
  }, [page]);

  const approve = (request) => {
    setRequests((current) =>
      current.map((r) => (r.id === request.id ? { ...r, status: "Approved" } : r)),
    );
    const pickup = {
      ...request,
      status: "Approved",
      date: pickupDate(request),
      slot: pickupSlot(request),
      time:
        request.time ||
        request.pickup?.split(" · ")[1] ||
        request.slot?.split(" – ")[0] ||
        "1:00 PM",
    };
    setPickups((current) =>
      current.some((p) => p.id === request.id)
        ? current.map((p) => (p.id === request.id ? pickup : p))
        : [...current, pickup],
    );
    notify(`${request.name}'s request approved.`);
  };
  const openDecline = (request) => {
    setDeclining(request);
    setReason("");
  };
  const decline = () => {
    if (!reason.trim()) {
      notifyError("Enter a reason so the student knows why the request was declined.");
      return;
    }
    setRequests((current) =>
      current.map((r) =>
        r.id === declining.id
          ? {
              ...r,
              status: "Declined",
              slotReserved: false,
              declineReason: reason.trim(),
            }
          : r,
      ),
    );
    if (declining.slotReserved && declining.slotId)
      setSlots((current) =>
        current.map((slot) =>
          slot.id === declining.slotId ? { ...slot, booked: Math.max(0, slot.booked - 1) } : slot,
        ),
      );
    notify(`${declining.name}'s request declined.`);
    setDeclining(null);
  };
  const openDistribution = (pickup) => {
    localStorage.setItem("panther-active-pickup", JSON.stringify(pickup));
    setSelectedPickup(pickup);
    navigate("/staff/distribution");
  };
  const addItem = (event) => {
    event.preventDefault();
    const match = availableCatalog.find((item) => item.id === itemId && item.onHand > 0);
    const count = Number(quantity);
    if (!match) {
      notifyError("Choose an available item from the dropdown.");
      return;
    }
    if (!Number.isInteger(count) || count < 1) {
      notifyError("Enter a whole-number quantity of at least 1.");
      return;
    }
    const existing = items.find((item) => item.id === match.id);
    if (count + (existing?.qty || 0) > match.onHand) {
      notifyError(
        `Only ${match.onHand} ${match.plural} of ${match.name.toLowerCase()} are available.`,
      );
      return;
    }
    setItems((current) => [
      {
        ...match,
        qty: (current.find((item) => item.id === match.id)?.qty || 0) + count,
      },
      ...current.filter((item) => item.id !== match.id),
    ]);
    setItemId("");
    setQuantity(1);
  };
  const completePickup = () => {
    const currentRequest = readSaved("panther-staff-requests", requests).find(
      (request) => request.id === selectedPickup.id,
    );
    if (currentRequest && ["Cancelled", "Declined"].includes(currentRequest.status)) {
      notifyError("This request is no longer active. Return to the pickup list.");
      return;
    }
    if (selectedPickup.firstVisit && !idChecked) {
      notifyError("Check the student ID card before completing this first pickup.");
      return;
    }
    if (!items.length) {
      notifyError("Add at least one item before completing the pickup.");
      return;
    }
    if (
      readSaved("panther-staff-pickups", pickups).some(
        (p) => p.id === selectedPickup.id && p.status === "Completed",
      )
    ) {
      notifyError("This pickup has already been completed.");
      return;
    }
    let updatedInventory;
    try {
      updatedInventory = distributeInventory(
        readSaved("panther-inventory-v1", inventory),
        displayedItems,
        selectedPickup.id,
        new Date().toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/Chicago",
        }),
      );
    } catch (error) {
      notifyError(error.message);
      return;
    }
    const completed = {
      ...selectedPickup,
      date: pickupDate(selectedPickup),
      status: "Completed",
      pickedUp: new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Chicago",
      }),
      items: displayedItems,
      idChecked,
    };
    setInventory(updatedInventory);
    setPickups((current) =>
      current.some((p) => p.id === completed.id)
        ? current.map((p) => (p.id === completed.id ? completed : p))
        : [...current, completed],
    );
    setRequests((current) =>
      current.some((r) => r.id === completed.id)
        ? current.map((r) =>
            r.id === completed.id ? { ...r, status: "Completed", items: displayedItems } : r,
          )
        : [
            ...current,
            {
              ...completed,
              pickup: completed.slot || completed.time,
              sent: "Walk-in",
            },
          ],
    );
    localStorage.setItem("panther-active-pickup", JSON.stringify(completed));
    setDayOffset(
      Math.round(
        (new Date(`${completed.date}T12:00:00Z`) - new Date("2026-10-14T12:00:00Z")) / 86400000,
      ),
    );
    notify(
      `Pickup completed for ${selectedPickup.name}. ${items.reduce((sum, item) => sum + item.qty, 0)} units handed out.`,
    );
    navigate("/staff/pickups");
  };

  return {
    waitingCount,
    dashboardPickups,
    lowStockItems,
    expiringLots,
    openDistribution,
    search,
    setSearch,
    approvedCount,
    filter,
    setFilter,
    filteredRequests,
    setSelectedRequest,
    approve,
    openDecline,
    activeRequest,
    dayOffset,
    dayPickups,
    doneCount,
    pendingCount,
    setDayOffset,
    setNoShowPickup,
    selectedPickup,
    pending,
    idChecked,
    setIdChecked,
    addItem,
    itemId,
    setItemId,
    availableCatalog,
    quantity,
    setQuantity,
    displayedItems,
    setItems,
    items,
    completePickup,
    declining,
    setDeclining,
    decline,
    reason,
    setReason,
    noShowPickup,
    setPickups,
    setRequests,
  };
}
