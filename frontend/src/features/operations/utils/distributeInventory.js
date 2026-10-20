export function distributeInventory(inventory, selectedItems, pickupId, timestamp) {
  const changesByItem = new Map();
  for (const selected of selectedItems) {
    if (!Number.isInteger(selected.qty) || selected.qty < 1)
      throw new Error("Every item needs a whole-number quantity of at least 1.");
    const item = inventory.find((candidate) => candidate.id === selected.id);
    const total = item?.lots.reduce((sum, lot) => sum + Math.max(0, Number(lot.quantity)), 0) || 0;
    if (!item || total < selected.qty)
      throw new Error(
        `Only ${total} ${item?.unit || "units"} of ${selected.name.toLowerCase()} are available. Update the pickup quantity.`,
      );
    if (item.changes?.some((change) => change.pickupId === pickupId))
      throw new Error("This pickup has already been recorded in inventory.");
    let remaining = selected.qty;
    const reductions = new Map();
    const changes = [];
    [...item.lots]
      .sort((a, b) => (a.expiry || "9999").localeCompare(b.expiry || "9999"))
      .forEach((lot) => {
        const used = Math.min(remaining, Math.max(0, Number(lot.quantity)));
        if (!used) return;
        reductions.set(lot.id, used);
        remaining -= used;
        changes.push({
          id: `${pickupId}-${lot.id}`,
          pickupId,
          when: timestamp,
          change: -used,
          reason: "Distribution",
          lot: lot.expiry
            ? `Expires ${new Date(`${lot.expiry}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : "No expiration date",
          by: "Dana Carter",
        });
      });
    changesByItem.set(item.id, {
      ...item,
      lots: item.lots.map((lot) => ({
        ...lot,
        quantity: Number(lot.quantity) - (reductions.get(lot.id) || 0),
      })),
      changes: [...changes, ...(item.changes || [])],
    });
  }
  return inventory.map((item) => changesByItem.get(item.id) || item);
}
