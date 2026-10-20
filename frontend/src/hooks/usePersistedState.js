import { useCallback, useEffect, useRef, useState } from "react";
import { auditChanges } from "../features/admin/audit/model.js";
import { auditKey, initialAuditLog } from "../features/admin/audit/data.js";
import { eventName, persistMockValue, readValue } from "../lib/mockStorage.js";

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

  const update = useCallback(
    (next) => {
      const previous = readValue(key, fallback.current);
      const result = typeof next === "function" ? next(previous) : next;
      persistMockValue(key, result);
      setValue(result);
      const entries = auditChanges(key, previous, result, readValue("panther-demo-profile", null));
      if (entries.length) {
        persistMockValue(auditKey, [...entries, ...readValue(auditKey, initialAuditLog)]);
      }
    },
    [key],
  );

  return [value, update];
}
