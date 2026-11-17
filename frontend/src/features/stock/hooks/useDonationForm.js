import { useState } from "react";
import { id } from "../utils/formatters.js";
import { notifyError } from "../../../components/Notifications.jsx";
import { donationItemIds, recordDonation } from "../../../api/operations.js";
import { savePhotoChange } from "../../../api/itemPhotos.js";
import { affected } from "../../../api/keys.js";
import { useRefresh } from "../../../lib/queryClient.js";

/** Item choice for something not in the inventory yet; it is created with the donation. */
export const NEW_ITEM = "new";

const newDonorRow = () => ({ id: id(), choice: "", name: "" });
const newLine = () => ({
  id: id(),
  itemId: "",
  quantity: 1,
  expiry: "",
  shelf: "",
  newItem: { name: "", category: "", unit: "", alert: "10" },
  photo: null,
});
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function useDonationForm({ items, donors, notify }) {
  const refresh = useRefresh();
  const donorOptions = donors;
  const [donorRows, setDonorRows] = useState(() => [newDonorRow()]);
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
  const updateNewItem = (lineId, patch) =>
    setLines((old) =>
      old.map((line) =>
        line.id === lineId ? { ...line, newItem: { ...line.newItem, ...patch } } : line,
      ),
    );
  const addItem = () => setLines((old) => [...old, newLine()]);
  const save = async (e) => {
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
    // Empty fields are caught by the browser (required); the database repeats every check.
    const newNames = new Set();
    for (const [index, line] of lines.entries()) {
      const n = index + 1;
      if (line.itemId === NEW_ITEM) {
        const name = line.newItem.name.trim();
        const key = name.toLowerCase();
        if (items.some((item) => item.name.trim().toLowerCase() === key)) {
          notifyError(
            `"${name}" is already in the inventory. Choose it from the list for item ${n}.`,
          );
          return;
        }
        if (newNames.has(key)) {
          notifyError(`Item ${n} adds "${name}" again. Add each new item once.`);
          return;
        }
        newNames.add(key);
      } else if (!items.some((item) => item.id === line.itemId)) {
        notifyError(`Choose an inventory item for item ${n}.`);
        return;
      }
      if (!Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1) {
        notifyError(`Enter a whole-number quantity of at least 1 for item ${n}.`);
        return;
      }
      if (!line.expiry || !line.shelf.trim()) {
        notifyError(`Enter an expiry date and choose a shelf or bin for item ${n}.`);
        return;
      }
    }
    const isNew = (line) => line.itemId === NEW_ITEM;
    const donation = await recordDonation({
      received,
      donors: donorNames,
      lines: lines.map((line) => ({
        itemId: isNew(line) ? null : line.itemId,
        newItem: isNew(line)
          ? {
              name: line.newItem.name.trim(),
              category: line.newItem.category,
              unit: line.newItem.unit.trim(),
              alert: Number(line.newItem.alert),
            }
          : null,
        quantity: line.quantity,
        expiry: line.expiry,
        shelf: line.shelf.trim(),
      })),
    });
    // Photos are optional, only for new items, and saved after the donation (they need the new
    // item's id). A failed photo never undoes the saved donation.
    const withPhotos = lines.filter((line) => isNew(line) && line.photo?.prepared);
    const unsaved = [];
    if (withPhotos.length) {
      let ids = new Map();
      try {
        ids = await donationItemIds(donation.id);
      } catch {
        // Each photo below then reports that its item could not be found.
      }
      for (const line of withPhotos) {
        const name = line.newItem.name.trim();
        try {
          const itemId = ids.get(name.toLowerCase());
          if (!itemId) throw new Error("The new item could not be found.");
          await savePhotoChange(itemId, line.photo);
        } catch (error) {
          unsaved.push({ name, error });
        }
      }
    }
    await refresh(affected.donation);
    setDonorRows([newDonorRow()]);
    setReceived("");
    setLines([]);
    if (unsaved.length) {
      const names = unsaved.map((entry) => entry.name);
      notifyError(
        `Donation saved, but the ${names.length > 1 ? "photos" : "photo"} for ${names.join(" and ")} ${names.length > 1 ? "weren't" : "wasn't"} saved: ${unsaved[0].error.message} Use Edit item to try again.`,
      );
    } else {
      const added = lines.filter(isNew).length;
      notify(
        `Donation saved. ${plural(units, "unit")} added to inventory${added ? `, including ${plural(added, "new item")}` : ""}.`,
      );
    }
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
    updateNewItem,
    units,
    setViewing,
    viewing,
  };
}
