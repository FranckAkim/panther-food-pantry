import { useCallback, useState } from "react";

// Per-tab screen state that should survive page changes (selected record, chosen day).
// Never put pantry records here; they come from Supabase.
export function readSession(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw);
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
  return fallback;
}

export function writeSession(key, value) {
  try {
    if (value === null || value === undefined) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Keep working without storage. */
  }
}

export function useSessionState(key, initialValue) {
  const [value, setValue] = useState(() =>
    readSession(key, typeof initialValue === "function" ? initialValue() : initialValue),
  );
  const update = useCallback(
    (next) =>
      setValue((current) => {
        const result = typeof next === "function" ? next(current) : next;
        writeSession(key, result);
        return result;
      }),
    [key],
  );
  return [value, update];
}
