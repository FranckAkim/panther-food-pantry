import { useState } from "react";
import { id, actionTime, dateText } from "../utils/formatters.js";
import { notifyError } from "../../../components/Notifications.jsx";

export function useDonationForm({ items, setItems, donations, setDonations, navigate, notify }) {
  const donorOptions = [
    ...new Set(donations.flatMap((donation) => donation.donors || [donation.donor])),
  ];
  const [donorRows, setDonorRows] = useState(() => [{ id: id(), choice: "", name: "" }]);
  const [received, setReceived] = useState("");
  const [lines, setLines] = useState([]);
  const [viewing, setViewing] = useState(null);
  const donorNames = donorRows.map((row) =>
    (row.choice === "other" ? row.name : row.choice.slice(6)).trim(),
  );
  const detailsReady = Boolean(received && donorNames.length && donorNames.every(Boolean));
  const units = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  const updateDonor = (rowId, patch) =>
    setDonorRows((rows) => rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  const updateLine = (lineId, patch) =>
    setLines((old) => old.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  const addItem = () =>
    setLines((old) => [...old, { id: id(), itemId: "", quantity: 1, expiry: "", shelf: "" }]);
  const save = (e) => {
    e.preventDefault();
    if (!donorNames.length || donorNames.some((name) => !name)) {
      notifyError("Choose a donor or enter a name for each donor.");
      return;
    }
    if (new Set(donorNames.map((name) => name.toLowerCase())).size !== donorNames.length) {
      notifyError("Each donor should only be added once.");
      return;
    }
    if (!received) {
      notifyError("Choose the date this donation was received.");
      return;
    }
    if (!lines.length) {
      notifyError("Add at least one item to this donation.");
      return;
    }
    for (const [index, line] of lines.entries()) {
      if (!items.some((item) => item.id === line.itemId)) {
        notifyError(`Choose an inventory item for item ${index + 1}.`);
        return;
      }
      if (!Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1) {
        notifyError(`Enter a whole-number quantity of at least 1 for item ${index + 1}.`);
        return;
      }
      if (!line.expiry || !line.shelf.trim()) {
        notifyError(`Enter an expiry date and shelf or bin for item ${index + 1}.`);
        return;
      }
    }
    const donor = donorNames.join(", ");
    const entryId = id();
    const savedLines = lines.map((line) => ({
      ...line,
      quantity: Number(line.quantity),
      shelf: line.shelf.trim(),
      name: items.find((item) => item.id === line.itemId).name,
    }));
    setItems((old) =>
      old.map((item) => {
        const matching = savedLines.filter((line) => line.itemId === item.id);
        return matching.length
          ? {
              ...item,
              lots: [
                ...item.lots,
                ...matching.map((line) => ({
                  id: id(),
                  quantity: line.quantity,
                  expiry: line.expiry,
                  shelf: line.shelf,
                  received,
                  source: `Donation · ${donor}`,
                })),
              ],
              changes: [
                ...matching.map((line) => ({
                  id: id(),
                  when: actionTime(),
                  change: line.quantity,
                  reason: "Donation",
                  lot: `Expires ${dateText(line.expiry, false)}`,
                  by: "Dana Carter",
                })),
                ...item.changes,
              ],
            }
          : item;
      }),
    );
    setDonations((old) => [
      {
        id: entryId,
        donor,
        donors: donorNames,
        received,
        lines: savedLines.length,
        units,
        details: savedLines,
      },
      ...old,
    ]);
    setDonorRows([{ id: id(), choice: "", name: "" }]);
    setReceived("");
    setLines([]);
    notify(`Donation saved. ${units} units added to inventory.`);
  };

  return {
    save,
    donorRows,
    updateDonor,
    donorOptions,
    donorNames,
    setDonorRows,
    received,
    setReceived,
    detailsReady,
    addItem,
    lines,
    setLines,
    updateLine,
    units,
    setViewing,
    viewing,
  };
}
