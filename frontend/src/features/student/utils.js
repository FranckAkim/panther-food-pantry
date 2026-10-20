export const onHand = (item) => item.lots.reduce((sum, lot) => sum + Number(lot.quantity), 0);

export const dateLabel = (date) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

export function slotLabel(slot) {
  const [hour, minute] = slot.time.split(":").map(Number);
  const start = new Date(2026, 0, 1, hour, minute);
  const end = new Date(start.getTime() + 30 * 60000);
  const format = (date) => date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${format(start).replace(/ (AM|PM)$/, "")} – ${format(end)}`;
}
