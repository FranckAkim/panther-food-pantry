import { LoadingState } from "./LoadingState.jsx";
import { Button } from "../ui/Button.jsx";

/**
 * Shows a loading state, an error with a retry button, or the content.
 * Pass one or more TanStack queries: <DataLoader queries={[a, b]}>.
 */
export function DataLoader({ queries = [], label, children, compact = false }) {
  const list = Array.isArray(queries) ? queries : [queries];
  const failed = list.find((query) => query?.isError && !query.data);
  const loading = list.some((query) => query?.isPending && !query.data);
  return (
    <div className="data-loader" aria-busy={loading}>
      {failed ? (
        <div className={`loading-state${compact ? " loading-state--compact" : ""}`} role="alert">
          <span>{failed.error?.message || "This information could not be loaded."}</span>
          <Button variant="secondary" onClick={() => list.forEach((query) => query?.refetch())}>
            Try again
          </Button>
        </div>
      ) : loading ? (
        <LoadingState label={label} compact={compact} />
      ) : (
        children
      )}
    </div>
  );
}
