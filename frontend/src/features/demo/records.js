import { demoPeople } from "./people.js";

const statusFor = (index) => {
  if (index < 15) return "Waiting";
  if (index < 29) return "Approved";
  if (index < 40) return "Completed";
  if (index < 43) return "Declined";
  if (index < 46) return "Cancelled";
  return "No-show";
};

const options = [
  ["10:00", "10:00 AM", "10:00 – 10:30 AM"],
  ["10:30", "10:30 AM", "10:30 – 11:00 AM"],
  ["11:00", "11:00 AM", "11:00 – 11:30 AM"],
  ["13:00", "1:00 PM", "1:00 – 1:30 PM"],
  ["13:30", "1:30 PM", "1:30 – 2:00 PM"],
];

const foods = [
  ["black-beans", "Canned black beans", 2],
  ["rice", "White rice (2 lb)", 1],
  ["spaghetti", "Spaghetti", 1],
  ["milk", "Shelf-stable milk", 2],
  ["cereal", "Cereal", 1],
];

// Keep the date anchored to the UI's existing Oct 14 walkthrough calendar.
export const expandedRequests = demoPeople.map((person, index) => {
  const status = statusFor(index);
  const date =
    index < 29
      ? index % 2
        ? "2026-10-21"
        : "2026-10-20"
      : index < 40
        ? "2026-10-14"
        : "2026-10-13";
  const [slotTime, time, slot] = options[index % options.length];
  const [foodId, foodName, qty] = foods[index % foods.length];
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return {
    id: person.recordId,
    name: person.name,
    studentId: person.id,
    date,
    fullPickupDate: day,
    time,
    slot,
    slotId: `${date}-${slotTime}`,
    slotReserved: status === "Waiting" || status === "Approved",
    pickup: `${day} · ${time}`,
    sent: `Oct ${index < 29 ? 13 : 12}, ${9 + (index % 6)}:15 AM`,
    status,
    note: index % 9 === 0 ? "Vegetarian options, please" : "",
    firstVisit: index % 7 === 0,
    foodId,
    foodName,
    requestedItems: [{ id: foodId, name: foodName, qty }],
    ...(status === "Declined" ? { declineReason: "Requested pickup time unavailable" } : {}),
    ...(status === "Completed" ? { items: [{ id: foodId, name: foodName, qty }] } : {}),
  };
});

export const expandedPickups = expandedRequests
  .filter((request) => ["Approved", "Completed", "No-show"].includes(request.status))
  .map((request) => ({
    ...request,
    ...(request.status === "Completed" ? { pickedUp: request.time } : {}),
  }));
