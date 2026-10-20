import { useState, useEffect } from "react";
import { waitForMockResponse, mockLatency } from "../../lib/mockLatency.js";
import { LoadingState } from "./LoadingState.jsx";

export function DataLoader({ queryKey, label, children, initialLoading = true, compact = false }) {
  const [ready, setReady] = useState(() => (initialLoading ? null : queryKey));
  useEffect(() => {
    const controller = new AbortController();
    waitForMockResponse(initialLoading ? mockLatency.page : mockLatency.query, controller.signal)
      .then(() => setReady(queryKey))
      .catch(() => {});
    return () => controller.abort();
  }, [queryKey, initialLoading]);
  const loading = ready !== queryKey;
  return (
    <div className="data-loader" aria-busy={loading}>
      {loading ? <LoadingState label={label} compact={compact} /> : children}
    </div>
  );
}
