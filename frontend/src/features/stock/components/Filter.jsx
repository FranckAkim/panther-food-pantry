export function Filter({ selected, onClick, children }) {
  return (
    <button
      type="button"
      className={`stock-filter${selected ? " is-selected" : ""}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
