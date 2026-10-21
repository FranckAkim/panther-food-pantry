export function Spinner({ large = false }) {
  return (
    <span
      className={`loading-spinner${large ? " loading-spinner--large" : ""}`}
      aria-hidden="true"
    />
  );
}
