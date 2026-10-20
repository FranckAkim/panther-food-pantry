import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { mockLatency, waitForMockResponse } from '../data/mockLatency.js';
import { notifyError } from './Notifications.jsx';

const ActionContext = createContext(null);
export const FormActionContext = createContext(null);
export const usePendingAction = () => useContext(ActionContext);

export function LoadingProvider({ children }) {
  const [pending, setPending] = useState(null);
  const request = useRef(null);
  const cancel = useCallback(key => {
    if (request.current && (!key || request.current.key === key)) {
      request.current.controller.abort();
      request.current = null;
      setPending(null);
    }
  }, []);
  useEffect(() => {
    const onNavigate = () => cancel();
    window.addEventListener('hashchange', onNavigate);
    return () => { window.removeEventListener('hashchange', onNavigate); request.current?.controller.abort(); };
  }, [cancel]);
  const run = useCallback(async (key, action, delay = mockLatency.action) => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = { key, controller };
    setPending(key);
    try {
      await waitForMockResponse(delay, controller.signal);
      if (!controller.signal.aborted) await action(controller.signal);
    } catch (error) {
      if (error.name !== 'AbortError') notifyError(error.message || 'Something went wrong. Please try again.');
    } finally {
      if (request.current?.controller === controller) { request.current = null; setPending(null); }
    }
  }, []);
  return <ActionContext.Provider value={{ pending, run, cancel }}>{children}</ActionContext.Provider>;
}

export function Spinner({ large = false }) {
  return <span className={`loading-spinner${large ? ' loading-spinner--large' : ''}`} aria-hidden="true" />;
}

export function LoadingState({ label = 'Loading…', compact = false }) {
  return <div className={`loading-state${compact ? ' loading-state--compact' : ''}`} role="status" aria-live="polite"><Spinner large /><span>{label}</span></div>;
}

export function DataLoader({ queryKey, label, children, initialLoading = true, compact = false }) {
  const [ready, setReady] = useState(() => initialLoading ? null : queryKey);
  useEffect(() => {
    const controller = new AbortController();
    waitForMockResponse(initialLoading ? mockLatency.page : mockLatency.query, controller.signal)
      .then(() => setReady(queryKey)).catch(() => {});
    return () => controller.abort();
  }, [queryKey, initialLoading]);
  const loading = ready !== queryKey;
  return <div className="data-loader" aria-busy={loading}>{loading ? <LoadingState label={label} compact={compact} /> : children}</div>;
}
