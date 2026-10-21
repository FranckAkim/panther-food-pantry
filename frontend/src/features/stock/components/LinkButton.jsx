export function LinkButton({ children, onClick, underline = false }) {
  return (
    <button
      type="button"
      className={`stock-link${underline ? " stock-link-underlined" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
