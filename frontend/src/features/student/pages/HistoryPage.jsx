import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { Badge } from "../../../components/ui/Badge.jsx";
import { Card } from "../../../components/ui/Card.jsx";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";

export function HistoryPage({ open, navigate, past }) {
  return (
    <>
      <PageHeading title="History" />
      {open && (
        <section>
          <h2>Open request</h2>
          <button
            className="student-history-open"
            onClick={() => navigate("/student/request-status")}
          >
            <span>
              <strong>{open.foodName || open.fullPickupDate}</strong>
              <small>
                {open.fullPickupDate} · {open.slot}
              </small>
            </span>
            <Badge>{open.status === "Waiting" ? "Submitted" : open.status}</Badge>
            <span aria-hidden="true">→</span>
          </button>
        </section>
      )}
      <section>
        <h2 className="student-past-heading">Past requests</h2>
        {past.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Food</th>
                  <th>Date</th>
                  <th>Pickup time</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {past.map((request) => (
                  <tr key={request.id}>
                    <td>{request.foodName || "Pantry food"}</td>
                    <td>{request.fullPickupDate}</td>
                    <td>{request.slot}</td>
                    <td>
                      <Badge>{request.status}</Badge>
                    </td>
                    <td>{request.declineReason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Card>
            <EmptyState
              title="No past requests yet"
              description="Completed, cancelled, and declined requests will appear here."
            />
          </Card>
        )}
      </section>
    </>
  );
}
