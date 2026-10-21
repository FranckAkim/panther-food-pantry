import { useState, useRef, useCallback, useEffect } from "react";
import { mockLatency, waitForMockResponse } from "../../lib/mockLatency.js";
import { notifyError } from "../Notifications.jsx";
import { ActionContext } from "./ActionContext.js";

export function LoadingProvider({ children }) {
  const [pending, setPending] = useState(null);
  const request = useRef(null);
  const cancel = useCallback((key) => {
    if (request.current && (!key || request.current.key === key)) {
      request.current.controller.abort();
      request.current = null;
      setPending(null);
    }
  }, []);
  useEffect(() => {
    const onNavigate = () => cancel();
    window.addEventListener("hashchange", onNavigate);
    return () => {
      window.removeEventListener("hashchange", onNavigate);
      request.current?.controller.abort();
    };
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
      if (error.name !== "AbortError")
        notifyError(error.message || "Something went wrong. Please try again.");
    } finally {
      if (request.current?.controller === controller) {
        request.current = null;
        setPending(null);
      }
    }
  }, []);
  return (
    <ActionContext.Provider value={{ pending, run, cancel }}>{children}</ActionContext.Provider>
  );
}
