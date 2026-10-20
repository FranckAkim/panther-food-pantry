import { Asset } from "./Asset.jsx";
import searchIcon from "../../../assets/stock-search.svg";

export function Search({ value, onChange, placeholder }) {
  return (
    <label className="stock-search">
      <Asset src={searchIcon} />
      <input
        className="input"
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
