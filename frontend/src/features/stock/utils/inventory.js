export const quantityOf = (item) => item.lots.reduce((sum, lot) => sum + Number(lot.quantity), 0);

export const nextExpiry = (item) =>
  item.lots
    .filter((l) => l.quantity > 0 && l.expiry)
    .map((l) => l.expiry)
    .sort()[0];

export const lowStock = (item) => quantityOf(item) < item.alert;

export const expiresSoon = (item) =>
  item.lots.some((l) => l.quantity > 0 && l.expiry && l.expiry <= "2026-10-21");

export const expiringLotCount = (items) =>
  items.reduce(
    (count, item) =>
      count +
      item.lots.filter((l) => l.quantity > 0 && l.expiry && l.expiry <= "2026-10-21").length,
    0,
  );
