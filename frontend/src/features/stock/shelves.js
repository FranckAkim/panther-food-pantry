// The pantry's fixed storage locations, offered as a dropdown wherever stock comes in
// (add item, add stock, donations). Codes follow the existing shelving: section letter,
// shelf number, then bin, so "A1-2" is section A, shelf 1, bin 2. Change this list only
// when the physical shelving changes; existing lots keep the location they were saved with.
export const shelfGroups = [
  { label: "A · Canned goods", shelves: ["A1-1", "A1-2", "A2-1", "A2-2", "A3-1", "A3-2"] },
  { label: "B · Protein", shelves: ["B1-1", "B1-2", "B2-1", "B2-2"] },
  { label: "C · Grains and pasta", shelves: ["C1-1", "C1-2", "C2-1", "C2-2"] },
  { label: "D · Breakfast and dairy", shelves: ["D1-1", "D1-2", "D2-1", "D2-2"] },
  { label: "E · Produce", shelves: ["E1-1", "E1-2"] },
  { label: "F · Personal care", shelves: ["F1-1", "F1-2", "F2-1", "F2-2"] },
];
