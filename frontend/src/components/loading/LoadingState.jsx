import { Spinner } from "./Spinner.jsx";

export function LoadingState({ label = "Loading…", compact = false }) {
  return (
    <div
      className={`loading-state${compact ? " loading-state--compact" : ""}`}
      role="status"
      aria-live="polite"
    >
      <Spinner large />
      <span>{label}</span>
    </div>
  );
}
