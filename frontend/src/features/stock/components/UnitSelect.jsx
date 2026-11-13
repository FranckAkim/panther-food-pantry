import { pluralUnit } from "../../../api/mappers.js";
import { unitOptions } from "../units.js";

/**
 * "Counted in" dropdown with the fixed units from units.js. Options read as plurals ("cans")
 * but the value is the singular unit that is stored ("can"). `current` keeps an item's existing
 * unit selectable if it is not in the list; `placeholder` adds an empty first option.
 */
export function UnitSelect({ current, placeholder, ...props }) {
  return (
    <select className="select" {...props}>
      {placeholder && <option value="">{placeholder}</option>}
      {unitOptions(current).map((unit) => (
        <option key={unit} value={unit}>
          {pluralUnit(unit)}
        </option>
      ))}
    </select>
  );
}
