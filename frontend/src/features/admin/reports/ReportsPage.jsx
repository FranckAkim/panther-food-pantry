import { useState, useMemo } from "react";
import { usePersistedState } from "../../../hooks/usePersistedState.js";
import { initialRequests, initialPickups } from "../../operations/data.js";
import { initialDonations } from "../../stock/data/donations.js";
import { initialItems } from "../../stock/data/inventory.js";
import { usePendingAction } from "../../../components/loading/ActionContext.js";
import { reportSnapshots } from "./data.js";
import { localDate, monthLabel } from "../../../lib/dates.js";
import { pickupDate } from "../../operations/utils/pickupDates.js";
import { buildReport, reportCsv } from "./model.js";
import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { AdminIcon } from "../../../components/AdminIcon.jsx";
import { DataLoader } from "../../../components/loading/DataLoader.jsx";
import { Card } from "../../../components/ui/Card.jsx";
import { Badge } from "../../../components/ui/Badge.jsx";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";

export function Reports({ notify }) {
  const [month, setMonth] = useState("2026-09");
  const [requests] = usePersistedState("panther-staff-requests", initialRequests);
  const [pickups] = usePersistedState("panther-staff-pickups", initialPickups);
  const [donations] = usePersistedState("panther-donations-v1", initialDonations);
  const [inventory] = usePersistedState("panther-inventory-v1", initialItems);
  const { pending } = usePendingAction();
  const months = [
    ...new Set([
      ...Object.keys(reportSnapshots),
      localDate(new Date()).slice(0, 7),
      ...requests.map((record) => pickupDate(record).slice(0, 7)),
      ...pickups.map((record) => pickupDate(record).slice(0, 7)),
      ...donations.map((record) => record.received.slice(0, 7)),
    ]),
  ]
    .sort()
    .reverse();
  const report = useMemo(
    () => buildReport(month, requests, pickups, donations, inventory, pickupDate),
    [month, requests, pickups, donations, inventory],
  );
  const resultTotal = report.results.reduce((sum, [, count]) => sum + count, 0);
  const exportCsv = () => {
    const url = URL.createObjectURL(
      new Blob([reportCsv(month, report)], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `panther-pantry-report-${month}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Exported the ${monthLabel(month)} report.`);
  };
  return (
    <>
      <PageHeading
        title="Reports"
        description="Counts only. No student names appear in reports."
        actions={
          <>
            <select
              className="select admin-month"
              aria-label="Report month"
              value={month}
              disabled={!!pending}
              onChange={(event) => setMonth(event.target.value)}
            >
              {months.map((value) => (
                <option key={value} value={value}>
                  {monthLabel(value)}
                </option>
              ))}
            </select>
            <Button variant="secondary" asyncAction loadingLabel="Exporting…" onClick={exportCsv}>
              <AdminIcon name="download" size={18} />
              Export CSV
            </Button>
          </>
        }
      />
      <DataLoader queryKey={month} initialLoading={false} label="Loading report…">
        <div className="admin-metrics">
          {[
            ["Students served", report.students],
            ["Pickups completed", report.completed],
            ["Units handed out", report.units],
            ["Donations received", report.donations],
            ["Units expired", report.expired],
          ].map(([label, value]) => (
            <Card key={label}>
              <p>{label}</p>
              <strong>{value.toLocaleString("en-US")}</strong>
            </Card>
          ))}
        </div>
        <div className="admin-report-tables">
          <Card>
            <h2>Requests by result</h2>
            <table className="admin-summary-table">
              <thead>
                <tr>
                  <th>Result</th>
                  <th>Requests</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {report.results.map(([status, count]) => (
                  <tr key={status}>
                    <td>
                      <Badge
                        tone={
                          {
                            Completed: "success",
                            "No-show": "warning",
                            Cancelled: "neutral",
                            Declined: "danger",
                          }[status]
                        }
                      >
                        {status}
                      </Badge>
                    </td>
                    <td>{count}</td>
                    <td className="muted">
                      {resultTotal ? Math.round((count / resultTotal) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card>
            <h2>Most handed out</h2>
            {report.items.length ? (
              <table className="admin-summary-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Units</th>
                  </tr>
                </thead>
                <tbody>
                  {report.items.map(([name, units]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{units.toLocaleString("en-US")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState
                title="No item totals yet"
                description="Item totals appear after pickups with recorded items are completed."
              />
            )}
          </Card>
        </div>
        {!reportSnapshots[month] && (
          <p className="admin-report-note">
            Item totals include pickups with recorded item details. Expired units count stock
            remaining past its expiry date.
          </p>
        )}
      </DataLoader>
    </>
  );
}
