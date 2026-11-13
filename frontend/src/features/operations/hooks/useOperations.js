// Workflow state for the dashboard, requests, pickups, and handing out food.
import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePendingAction } from "../../../components/loading/ActionContext.js";
import { notifyError } from "../../../components/Notifications.jsx";
import { affected, keys } from "../../../api/keys.js";
import {
  completeDistribution,
  decideRequest,
  fetchPickups,
  fetchStaffRequests,
  markNoShow,
} from "../../../api/requests.js";
import { fetchInventory } from "../../../api/inventory.js";
import { addDays, pantryToday, shortDate } from "../../../api/time.js";
import { useRefresh } from "../../../lib/queryClient.js";
import { readSession, useSessionState, writeSession } from "../../../hooks/useSessionState.js";

export const ACTIVE_PICKUP_KEY = "panther-active-pickup";

const daysBetween = (from, to) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);

export function useOperations({ page, navigate, notify }) {
  const { pending } = usePendingAction();
  const refresh = useRefresh();
  const today = pantryToday();
  const [dayOffset, setDayOffset] = useSessionState("panther-pickup-day", 0);
  const pickupDate = page === "dashboard" ? today : addDays(today, dayOffset);
  const requestsQuery = useQuery({
    queryKey: keys.requests,
    queryFn: fetchStaffRequests,
    enabled: ["dashboard", "requests", "request-detail"].includes(page),
  });
  const pickupsQuery = useQuery({
    queryKey: keys.pickups(pickupDate),
    queryFn: () => fetchPickups(pickupDate),
    enabled: ["dashboard", "pickups"].includes(page),
  });
  const inventoryQuery = useQuery({
    queryKey: keys.inventory,
    queryFn: fetchInventory,
    enabled: ["dashboard", "distribution"].includes(page),
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Waiting");
  const [declining, setDeclining] = useState(null);
  const [reason, setReason] = useState("");
  const [selectedRequest, setSelectedRequest] = useSessionState("panther-selected-request", null);
  const [selectedPickup, setSelectedPickup] = useState(() => readSession(ACTIVE_PICKUP_KEY, null));
  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [idChecked, setIdChecked] = useState(false);
  const [noShowPickup, setNoShowPickup] = useState(null);

  const requests = requestsQuery.data || [];
  const waitingCount = requests.filter((r) => r.dbStatus === "submitted").length;
  const approvedCount = requests.filter((r) => r.dbStatus === "approved").length;
  const dayPickups = pickupsQuery.data || [];
  const dashboardPickups = page === "dashboard" ? dayPickups : [];
  const doneCount = dayPickups.filter((p) => p.dbStatus === "completed").length;
  const pendingCount = dayPickups.filter((p) => p.dbStatus === "approved").length;
  const inventory = inventoryQuery.data || [];
  const availableCatalog = useMemo(
    () =>
      inventory
        .filter((item) => item.available > 0)
        .map((item) => ({
          id: item.id,
          name: item.name,
          imagePath: item.imagePath,
          unit: item.unitName,
          plural: item.unit,
          onHand: item.available,
          lotLabel: `${item.nextLot?.expiry ? `Expires ${shortDate(item.nextLot.expiry)}` : "No expiry date"} · ${item.nextLot?.shelf || "—"}`,
          expiring: Boolean(item.nextLot?.expiringSoon),
        })),
    [inventory],
  );
  // The food the student chose when requesting (none for walk-ins). Pickups saved in this tab
  // before the server returned item ids are matched by name.
  const requestedItemId = selectedPickup?.requestId
    ? selectedPickup.itemId ||
      inventory.find((item) => item.name === selectedPickup.foodName)?.id ||
      null
    : null;
  const requestedFood =
    selectedPickup?.requestId && selectedPickup.foodName
      ? {
          name: selectedPickup.foodName,
          available: availableCatalog.some((item) => item.id === requestedItemId),
        }
      : null;
  const displayedItems = items.map((item) => ({
    ...item,
    ...availableCatalog.find((candidate) => candidate.id === item.id),
    qty: item.qty,
    requested: item.id === requestedItemId,
  }));
  const units = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const lowStockItems = inventory.filter((item) => item.available < item.alert);
  const expiringLots = inventory.flatMap((item) =>
    item.lots
      .filter((lot) => lot.expiringSoon)
      .map((lot) => ({ ...lot, itemName: item.name, unit: item.unit })),
  );
  const activeRequest = requests.find((r) => r.id === selectedRequest) || null;
  const filteredRequests = useMemo(
    () =>
      requests.filter(
        (r) =>
          (filter === "All" || r.status === filter) &&
          `${r.name} ${r.studentId}`.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [requests, filter, search],
  );

  const prefilledFor = useRef(null);
  useEffect(() => {
    if (page === "distribution") {
      const active = readSession(ACTIVE_PICKUP_KEY, null);
      setSelectedPickup(active);
      setIdChecked(active?.idChecked === true);
      setItems([]);
      setItemId("");
      setQuantity(1);
      prefilledFor.current = null;
    }
  }, [page]);
  // Start the list with the requested food (quantity 1) once stock has loaded, if it is still
  // available. Staff can change the quantity, remove it, or add other items.
  useEffect(() => {
    if (page !== "distribution" || !inventoryQuery.isSuccess || !selectedPickup?.requestId) return;
    if (prefilledFor.current === selectedPickup.requestId) return;
    prefilledFor.current = selectedPickup.requestId;
    if (availableCatalog.some((item) => item.id === requestedItemId))
      setItems([{ id: requestedItemId, qty: 1 }]);
  }, [page, inventoryQuery.isSuccess, selectedPickup, availableCatalog, requestedItemId]);

  const approve = async (request) => {
    await decideRequest(request.id, true);
    await refresh(affected.request);
    notify(`${request.name}'s request approved.`);
  };
  const openDecline = (request) => {
    setDeclining(request);
    setReason("");
  };
  const decline = async () => {
    if (!reason.trim()) {
      notifyError("Enter a reason so the student knows why the request was declined.");
      return;
    }
    await decideRequest(declining.id, false, reason.trim());
    await refresh(affected.request);
    notify(`${declining.name}'s request declined.`);
    setDeclining(null);
  };
  const confirmNoShow = async () => {
    await markNoShow(noShowPickup.requestId);
    await refresh(affected.request);
    notify(`${noShowPickup.name} marked as a no-show.`);
    setNoShowPickup(null);
  };
  const openDistribution = (pickup) => {
    writeSession(ACTIVE_PICKUP_KEY, pickup);
    setSelectedPickup(pickup);
    navigate("/staff/distribution");
  };
  const addItem = (event) => {
    event.preventDefault();
    const match = availableCatalog.find((item) => item.id === itemId);
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
    const already = Number(existing?.qty) || 0;
    if (count + already > match.onHand) {
      notifyError(
        `Only ${match.onHand} ${match.plural} of ${match.name.toLowerCase()} are available.`,
      );
      return;
    }
    setItems((current) => [
      { id: match.id, qty: already + count },
      ...current.filter((item) => item.id !== match.id),
    ]);
    setItemId("");
    setQuantity(1);
  };
  /** Quantity typed in a line of the list; kept as typed ("" while editing), checked on complete. */
  const setItemQty = (id, value) =>
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, qty: value === "" ? "" : Number(value) } : item,
      ),
    );
  const completePickup = async () => {
    if (selectedPickup.firstVisit && !idChecked) {
      notifyError("Check the student ID card before completing this first pickup.");
      return;
    }
    if (!items.length) {
      notifyError("Add at least one item before completing the pickup.");
      return;
    }
    for (const item of displayedItems) {
      if (!Number.isInteger(item.qty) || item.qty < 1) {
        notifyError(`Enter a whole-number quantity of at least 1 for ${item.name}.`);
        return;
      }
      if (item.qty > item.onHand) {
        notifyError(
          `Only ${item.onHand} ${item.plural} of ${item.name.toLowerCase()} are available.`,
        );
        return;
      }
    }
    const walkIn = !selectedPickup.requestId;
    try {
      await completeDistribution({
        requestId: selectedPickup.requestId || null,
        profileId: walkIn && selectedPickup.kind === "account" ? selectedPickup.recipientId : null,
        provisionalStudentId:
          walkIn && selectedPickup.kind === "provisional" ? selectedPickup.recipientId : null,
        items: displayedItems,
        idChecked,
      });
    } catch (error) {
      // Stock or the request may have changed since this page loaded.
      await refresh([keys.inventory, ["pickups"]]);
      throw error;
    }
    await refresh(affected.distribution);
    writeSession(ACTIVE_PICKUP_KEY, null);
    setDayOffset(selectedPickup.date ? daysBetween(today, selectedPickup.date) : 0);
    notify(
      `Pickup completed for ${selectedPickup.name}. ${units} ${units === 1 ? "unit" : "units"} handed out.`,
    );
    navigate("/staff/pickups");
  };

  return {
    queries: { requests: requestsQuery, pickups: pickupsQuery, inventory: inventoryQuery },
    today,
    pickupDate,
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
    setItemQty,
    items,
    units,
    requestedFood,
    completePickup,
    declining,
    setDeclining,
    decline,
    reason,
    setReason,
    noShowPickup,
    confirmNoShow,
  };
}
