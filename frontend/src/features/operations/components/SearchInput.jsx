import { Asset } from "./Asset.jsx";

export function SearchInput({ value, onChange, placeholder, label, ...props }) {
  return (
    <div className="sr-search">
      <Asset name="search" />
      <input
        className="input"
        type="search"
        aria-label={label || placeholder}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...props}
      />
    </div>
  );
}
