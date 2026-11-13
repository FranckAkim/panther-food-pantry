import { useState, useRef, useCallback, useEffect } from "react";
import { notifyError } from "../Notifications.jsx";
import { ActionContext } from "./ActionContext.js";

// Runs one user action at a time (form submit or async button) and shows its errors.
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
  const run = useCallback(async (key, action) => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = { key, controller };
    setPending(key);
    try {
      await action(controller.signal);
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
