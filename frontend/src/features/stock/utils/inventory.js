// Inventory figures for items shaped by api/mappers.js (mapInventoryItem).

/** Units that can be handed out: received, unexpired lots with stock. */
export const quantityOf = (item) => item.available;

export const expiredQuantity = (item) =>
  item.lots.filter((lot) => lot.expired).reduce((sum, lot) => sum + Number(lot.quantity), 0);

export const nextExpiry = (item) => item.nextLot?.expiry;

export const lowStock = (item) => item.available < item.alert;

export const expiresSoon = (item) => item.lots.some((lot) => lot.expiringSoon);

export const expiringLotCount = (items) =>
  items.reduce((count, item) => count + item.lots.filter((lot) => lot.expiringSoon).length, 0);
