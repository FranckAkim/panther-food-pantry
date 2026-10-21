export const id = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const dateText = (value, year = true) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        ...(year ? { year: "numeric" } : {}),
      })
    : "—";

export const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

export const actionTime = () =>
  new Date().toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
