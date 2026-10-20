import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { SearchInput } from "../components/SearchInput.jsx";
import { DataLoader } from "../../../components/loading/DataLoader.jsx";
import { Card } from "../../../components/ui/Card.jsx";
import { Badge } from "../../../components/ui/Badge.jsx";
import { Asset } from "../components/Asset.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { Status } from "../components/Status.jsx";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";

export function RequestsPage({
  search,
  setSearch,
  waitingCount,
  approvedCount,
  filter,
  setFilter,
  filteredRequests,
  setSelectedRequest,
  navigate,
  approve,
  openDecline,
}) {
  return (
    <>
      <PageHeading
        title="Requests"
        description="Approve or decline new requests. Declining needs a reason."
        actions={
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or student ID"
          />
        }
      />
      <div className="sr-filter-group" role="group" aria-label="Filter requests">
        {[
          ["Waiting", `Waiting · ${waitingCount}`],
          ["Approved", `Approved · ${approvedCount}`],
          ["All", "All"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={`sr-filter ${filter === value ? "active" : ""}`}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <DataLoader
        queryKey={JSON.stringify([search, filter])}
        initialLoading={false}
        label="Loading requests…"
      >
        <Card className="sr-requests-card">
          <div className="table-wrap">
            <table className="data-table sr-requests-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Pickup</th>
                  <th>Sent</th>
                  <th>Food / note</th>
                  <th>ID card</th>
                  <th className="sr-actions-heading">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <button
                        className="sr-person-link sr-person-strong"
                        onClick={() => {
                          setSelectedRequest(request.id);
                          navigate("/staff/request-detail");
                        }}
                      >
                        {request.name}
                      </button>
                      <div className="muted">{request.studentId}</div>
                    </td>
                    <td>{request.pickup}</td>
                    <td className="muted">{request.sent}</td>
                    <td>
                      {request.foodName && (
                        <div>
                          <strong>{request.foodName}</strong>
                        </div>
                      )}
                      {request.note || (!request.foodName && <span className="muted">—</span>)}
                    </td>
                    <td>
                      {request.firstVisit ? (
                        <Badge tone="gold">First visit</Badge>
                      ) : (
                        <span className="sr-checked">
                          <Asset name="checked" />
                          Checked
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="sr-table-actions">
                        {request.status === "Waiting" ? (
                          <>
                            <Button
                              asyncAction
                              loadingLabel="Approving…"
                              onClick={() => approve(request)}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="secondary"
                              className="sr-decline-button"
                              onClick={() => openDecline(request)}
                            >
                              Decline
                            </Button>
                          </>
                        ) : (
                          <Status status={request.status} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filteredRequests.length && (
            <EmptyState
              title="No requests found"
              description={
                search
                  ? "Try a different name or student ID."
                  : "There are no requests in this view."
              }
            />
          )}
        </Card>
      </DataLoader>
    </>
  );
}
