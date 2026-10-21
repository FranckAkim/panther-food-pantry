export function Badge({ children, tone, className = "" }) {
  const text = typeof children === "string" ? children.toLowerCase() : "";
  const inferred = /declined|no-show|out of stock|inactive/.test(text)
    ? "danger"
    : /approved|completed|in stock|active|verified/.test(text)
      ? "success"
      : /pending|submitted|low stock|expir|first visit|provisional/.test(text)
        ? "warning"
        : "neutral";
  return <span className={`badge badge--${tone || inferred} ${className}`}>{children}</span>;
}
