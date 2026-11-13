// Pantry categories offered when adding or editing an item. Items may also use
// other categories already stored in the database; those appear in the lists too.
export const categories = [
  "Canned goods",
  "Protein",
  "Grains and pasta",
  "Breakfast",
  "Dairy",
  "Produce",
  "Personal care",
];

/** The standard categories plus any others used by existing items, sorted. */
export const categoryOptions = (items = [], extra) =>
  [...new Set([...categories, ...items.map((item) => item.category), ...(extra ? [extra] : [])])]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
