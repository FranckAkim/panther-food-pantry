const chicagoToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

export function pickupDate(pickup) {
  if (pickup.date && /^\d{4}-\d{2}-\d{2}$/.test(pickup.date)) return pickup.date;
  const text = pickup.fullPickupDate || pickup.pickup || "";
  const match = text.match(/([A-Za-z]{3})\s+(\d{1,2})/);
  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ].indexOf(match?.[1]);
  if (match && month >= 0)
    return `2026-${String(month + 1).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  return pickup.time === "Walk-in" ? chicagoToday() : "2026-10-14";
}

export function pickupSlot(request) {
  if (request.slot) return request.slot;
  const time = request.time || request.pickup?.split(" · ")[1] || "1:00 PM";
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
  if (!match) return time;
  const total =
    ((Number(match[1]) % 12) + (match[3] === "PM" ? 12 : 0)) * 60 + Number(match[2]) + 30;
  const hour = Math.floor(total / 60) % 24;
  const end = `${hour % 12 || 12}:${String(total % 60).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
  return `${time.replace(/ (AM|PM)$/, "")} – ${end}`;
}
