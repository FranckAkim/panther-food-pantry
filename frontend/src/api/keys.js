// TanStack Query cache keys. Mutations invalidate by prefix (see useRefresh).
export const keys = {
  foods: ["foods"],
  categoryAvailability: ["category-availability"],
  slots: (from, to) => ["slots", from, to],
  myRequests: ["my-requests"],
  requests: ["requests"],
  pickups: (date) => ["pickups", date],
  inventory: ["inventory"],
  itemHistory: (itemId) => ["item-history", itemId],
  donations: ["donations"],
  donors: ["donors"],
  students: ["students"],
  accounts: ["accounts"],
  reportMonths: ["report-months"],
  report: (month) => ["report", month],
  audit: ["audit"],
  profilePhotos: ["profile-photos"],
  myPhoto: (profileId) => ["my-photo", profileId],
};

// What each kind of change can affect.
export const affected = {
  request: [["requests"], ["pickups"], ["my-requests"], ["slots"], ["students"]],
  distribution: [
    ["requests"],
    ["pickups"],
    ["my-requests"],
    ["inventory"],
    ["item-history"],
    ["foods"],
    ["category-availability"],
    ["students"],
  ],
  inventory: [["inventory"], ["item-history"], ["foods"], ["category-availability"]],
  donation: [
    ["donations"],
    ["donors"],
    ["inventory"],
    ["item-history"],
    ["foods"],
    ["category-availability"],
  ],
  slots: [["slots"], ["pickups"]],
  students: [["students"], ["requests"], ["pickups"]],
  accounts: [["accounts"], ["students"]],
};
