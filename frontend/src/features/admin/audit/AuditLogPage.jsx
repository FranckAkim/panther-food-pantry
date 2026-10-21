import { usePersistedState } from "../../../hooks/usePersistedState.js";
import { auditKey, initialAuditLog } from "./data.js";
import { useMemo, useState } from "react";
import { localDate } from "../../../lib/dates.js";
import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { Search } from "../components/Search.jsx";
import { dateLabel } from "./formatters.js";
import { DataLoader } from "../../../components/loading/DataLoader.jsx";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";
import { Button } from "../../../components/ui/Button.jsx";

export function AuditLog() {
  const [entries] = usePersistedState(auditKey, initialAuditLog);
  const sorted = useMemo(
    () => [...entries].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)),
    [entries],
  );
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("");
  const [date, setDate] = useState(() => (sorted.length ? localDate(sorted[0].timestamp) : ""));
  const [page, setPage] = useState(0);
  const actions = [...new Set(entries.map((entry) => entry.action))].sort();
  const dates = [...new Set(entries.map((entry) => localDate(entry.timestamp)))].sort().reverse();
  const filtered = sorted.filter(
    (entry) =>
      (!action || entry.action === action) &&
      (!date || localDate(entry.timestamp) === date) &&
      `${entry.actor} ${entry.record} ${entry.action}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const pageSize = 8;
  const pageIndex = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
  const shown = filtered.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const filter = (setter) => (event) => {
    setter(event.target.value);
    setPage(0);
  };
  return (
    <>
      <PageHeading
        title="Audit log"
        description="Every staff action is saved: who did it, when, and what changed."
      />
      <div className="admin-toolbar">
        <Search
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(0);
          }}
          placeholder="Search person or record"
        />
        <select
          className="select admin-audit-filter"
          aria-label="Action"
          value={action}
          onChange={filter(setAction)}
        >
          <option value="">All actions</option>
          {actions.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          className="select admin-audit-filter"
          aria-label="Audit date"
          value={date}
          onChange={filter(setDate)}
        >
          <option value="">All dates</option>
          {dates.map((value) => (
            <option key={value} value={value}>
              {value === localDate(new Date()) ? "Today" : dateLabel(value)}
            </option>
          ))}
        </select>
      </div>
      <DataLoader
        queryKey={JSON.stringify([query, action, date, pageIndex])}
        initialLoading={false}
        label="Loading audit log…"
      >
        <div className="table-wrap">
          <table className="data-table admin-audit-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Record</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((entry) => (
                <tr key={entry.id}>
                  <td className="muted">
                    <time dateTime={entry.timestamp}>
                      {!date && <small>{dateLabel(localDate(entry.timestamp))}</small>}
                      {new Date(entry.timestamp).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: "America/Chicago",
                      })}
                    </time>
                  </td>
                  <td>{entry.actor}</td>
                  <td>
                    <strong>{entry.action}</strong>
                  </td>
                  <td>{entry.record}</td>
                  <td className="muted">{entry.change}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && (
            <EmptyState
              title="No actions found"
              description="Try a different person, record, action, or date."
            />
          )}
        </div>
        <div className="admin-pagination">
          <p className="muted" role="status">
            {filtered.length
              ? `Showing ${pageIndex * pageSize + 1}–${pageIndex * pageSize + shown.length} of ${filtered.length} actions`
              : "0 actions"}
            {date ? ` · ${dateLabel(date)}` : ""}
          </p>
          <div>
            <Button
              variant="secondary"
              disabled={pageIndex === 0}
              onClick={() => setPage(pageIndex - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={(pageIndex + 1) * pageSize >= filtered.length}
              onClick={() => setPage(pageIndex + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </DataLoader>
    </>
  );
}
