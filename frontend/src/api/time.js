// The pantry works in Central time; dates and times display in that zone for every viewer.
export const PANTRY_TIME_ZONE = "America/Chicago";

// Newer browsers put a narrow no-break space before AM/PM; use a plain space.
const clean = (text) => text.replace(/ /g, " ");

/** Calendar date (YYYY-MM-DD) in pantry time. */
export const pantryDate = (value = new Date()) =>
  new Date(value).toLocaleDateString("en-CA", { timeZone: PANTRY_TIME_ZONE });

export const pantryToday = () => pantryDate(new Date());

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(date, days) {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

/** "10:30 AM" */
export const timeLabel = (value) =>
  clean(
    new Date(value).toLocaleTimeString("en-US", {
      timeZone: PANTRY_TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
    }),
  );

/** "13:30" (24-hour), for time inputs and sorting. */
export const time24 = (value) =>
  new Date(value).toLocaleTimeString("en-GB", {
    timeZone: PANTRY_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

/** "10:00 – 10:30 AM", or "11:30 AM – 12:00 PM" when the period changes. */
export function slotLabel(startsAt, endsAt) {
  const start = timeLabel(startsAt);
  const end = timeLabel(endsAt);
  return `${start.slice(-2) === end.slice(-2) ? start.slice(0, -3) : start} – ${end}`;
}

/** "Wed, Oct 14" for a YYYY-MM-DD date. */
export const dayLabel = (date) =>
  date
    ? new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
        timeZone: "UTC",
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "—";

/** "Wednesday, Oct 14, 2026" for a YYYY-MM-DD date. */
export const longDateLabel = (date) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/** "Oct 14, 2026" (or "Oct 14") for a YYYY-MM-DD date. */
export const shortDate = (date, withYear = true) =>
  date
    ? new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
        ...(withYear ? { year: "numeric" } : {}),
      })
    : "—";

/** "Oct 14, 10:12 AM" */
export const dateTimeLabel = (value) =>
  clean(
    new Date(value).toLocaleString("en-US", {
      timeZone: PANTRY_TIME_ZONE,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  );

/** "Today, 9:12 AM", "Yesterday, 7:30 PM", or "Oct 13, 6:05 PM". */
export function sentLabel(value, now = new Date()) {
  const day = pantryDate(value);
  const today = pantryDate(now);
  const prefix =
    day === today ? "Today" : day === addDays(today, -1) ? "Yesterday" : shortDate(day, false);
  return `${prefix}, ${timeLabel(value)}`;
}
