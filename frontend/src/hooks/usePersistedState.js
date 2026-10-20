import { useCallback, useEffect, useRef, useState } from "react";

import { auditChanges } from '../data/audit.js';
import { auditKey, initialAuditLog } from '../data/admin.js';

const memory = new Map();
const eventName = "panther-demo-data";

function readValue(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw);
  } catch { /* Storage can be unavailable in private browsing. */ }
  return memory.has(key) ? memory.get(key) : fallback;
}

export function readMockValue(key, fallback) { return readValue(key, fallback); }
export function persistMockValue(key, value) {
  memory.set(key, value);
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Keep this session usable. */ }
  window.dispatchEvent(new CustomEvent(eventName, { detail: { key } }));
}

// Demo persistence is deliberately separate from the future session-cookie API.
// Never store passwords or authentication tokens here.
export function usePersistedState(key, initialValue) {
  const fallback = useRef(typeof initialValue === "function" ? initialValue() : initialValue);
  const [value, setValue] = useState(() => readValue(key, fallback.current));
  useEffect(() => {
    const sync = (event) => {
      if (!event.key || event.key === key || event.detail?.key === key) {
        setValue(readValue(key, fallback.current));
      }
    };
    window.addEventListener("storage", sync);
    window.addEventListener(eventName, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(eventName, sync);
    };
  }, [key]);
  const update = useCallback((next) => {
    const previous = readValue(key, fallback.current);
    const result = typeof next === "function" ? next(previous) : next;
    persistMockValue(key, result);
    setValue(result);
    const entries = auditChanges(key, previous, result, readValue('panther-demo-profile', null));
    if (entries.length) persistMockValue(auditKey, [...entries, ...readValue(auditKey, initialAuditLog)]);
  }, [key]);
  return [value, update];
}

export default usePersistedState;
