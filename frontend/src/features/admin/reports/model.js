import { reportSnapshots } from "./data.js";
import { localDate } from "../../../lib/dates.js";

export function buildReport(month, requests, pickups, donations, inventory, requestDate) {
  if (reportSnapshots[month]) return reportSnapshots[month];
  const included = (record) => requestDate(record).startsWith(month);
  const records = new Map(requests.filter(included).map((record) => [record.id, record]));
  pickups.filter(included).forEach((record) => records.set(record.id, record));
  const completed = [...records.values()].filter((record) => record.status === "Completed");
  const totals = new Map();
  completed.forEach((record) =>
    (record.items || []).forEach((item) =>
      totals.set(item.name, (totals.get(item.name) || 0) + Number(item.qty || 0)),
    ),
  );
  return {
    students: new Set(completed.map((record) => record.studentId || record.id)).size,
    completed: completed.length,
    units: [...totals.values()].reduce((sum, units) => sum + units, 0),
    donations: donations.filter((record) => record.received?.startsWith(month)).length,
    expired: inventory
      .flatMap((item) => item.lots)
      .filter((lot) => lot.expiry?.startsWith(month) && lot.expiry < localDate(new Date()))
      .reduce((sum, lot) => sum + Number(lot.quantity), 0),
    results: ["Completed", "No-show", "Cancelled", "Declined"].map((status) => [
      status,
      [...records.values()].filter((record) => record.status === status).length,
    ]),
    items: [...totals].sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}

export function reportCsv(month, report) {
  const total = report.results.reduce((sum, [, count]) => sum + count, 0);
  const rows = [
    ["Month", "Section", "Metric", "Count", "Share"],
    ...[
      ["Students served", report.students],
      ["Pickups completed", report.completed],
      ["Units handed out", report.units],
      ["Donations received", report.donations],
      ["Units expired", report.expired],
    ].map(([name, value]) => [month, "Summary", name, value, ""]),
    ...report.results.map(([name, count]) => [
      month,
      "Requests by result",
      name,
      count,
      `${total ? Math.round((count / total) * 100) : 0}%`,
    ]),
    ...report.items.map(([name, count]) => [month, "Most handed out", name, count, ""]),
  ];
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map(
            (value) =>
              `"${String(value)
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""')}"`,
          )
          .join(","),
      )
      .join("\r\n")
  );
}
