import { shelfGroups } from "../shelves.js";

/** Shelf or bin dropdown with the fixed locations from shelves.js. Other props go to the select. */
export function ShelfSelect(props) {
  return (
    <select className="select" {...props}>
      <option value="">Choose a shelf</option>
      {shelfGroups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.shelves.map((shelf) => (
            <option key={shelf}>{shelf}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
