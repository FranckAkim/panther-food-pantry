export const staffLinks = [
  ["dashboard", "Dashboard"],
  ["requests", "Requests"],
  ["pickups", "Today's pickups"],
  ["walk-in", "Walk-in"],
  ["inventory", "Inventory"],
  ["donations", "Donations"],
  ["students", "Students"],
  ["slots", "Pickup slots"],
];

export const adminPages = ["reports", "users", "audit-log"];

export const adminLinks = [
  ...staffLinks.filter(([key]) => key !== "students"),
  ["reports", "Reports"],
  ["users", "Users"],
  ["audit-log", "Audit log"],
];

export const operationsPages = [
  "dashboard",
  "requests",
  "request-detail",
  "pickups",
  "distribution",
];

export const stockPages = [
  "inventory",
  "item-detail",
  "donations",
  "students",
  "student-profile",
  "slots",
  "pickup-slots",
];

export const pageTitles = {
  "sign-in": "Sign in",
  register: "Create account",
  home: "Home",
  request: "Request food",
  history: "History",
  "request-status": "Your request",
  ...Object.fromEntries(staffLinks),
  ...Object.fromEntries(adminLinks),
  "item-detail": "Item details",
  "student-profile": "Student profile",
  distribution: "Hand out food",
  "request-detail": "Request details",
};

export const getRoute = () => window.location.hash.slice(1) || "/sign-in";
