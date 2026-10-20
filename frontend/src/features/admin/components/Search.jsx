export function Search({ value, onChange, placeholder }) {
  return (
    <div className="admin-search">
      <img src="/assets/staff-search.svg" alt="" />
      <input
        className="input"
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
