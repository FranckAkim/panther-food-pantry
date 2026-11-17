// CSV export of a monthly report returned by admin_monthly_report().
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
