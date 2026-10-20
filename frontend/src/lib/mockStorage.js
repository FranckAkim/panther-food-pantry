// React-free demo storage shared by authentication and persisted-state hooks.
const memory = new Map();

export const eventName = "panther-demo-data";

export function readValue(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw);
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
  return memory.has(key) ? memory.get(key) : fallback;
}

export function readMockValue(key, fallback) {
  return readValue(key, fallback);
}

export function persistMockValue(key, value) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Keep this session usable. */
  }
  window.dispatchEvent(new CustomEvent(eventName, { detail: { key } }));
}
