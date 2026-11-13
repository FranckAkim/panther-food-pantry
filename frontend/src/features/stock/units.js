// How the pantry counts its items, offered as a dropdown when adding or editing an item
// (including new items added with a donation). Units are stored in the singular ("can"); the
// app adds the plural where needed ("3 cans", see pluralUnit in api/mappers.js). The first ten
// are the units the inventory already uses; "pouch" and "each" (loose items) are common extras.
// Change this list only when the pantry starts stocking something counted differently.
export const units = [
  "can",
  "jar",
  "bottle",
  "carton",
  "box",
  "bag",
  "canister",
  "pack",
  "bar",
  "tube",
  "pouch",
  "each",
];

/** The fixed units, plus an item's current unit if it was saved with one not in the list. */
export const unitOptions = (current) =>
  current && !units.includes(current) ? [...units, current] : units;
