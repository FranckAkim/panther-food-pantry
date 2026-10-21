export const localDate = (value) =>
  new Date(value).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

export const monthLabel = (value) =>
  new Date(`${value}-01T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
