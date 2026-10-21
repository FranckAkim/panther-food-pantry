import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { Status } from "../components/Status.jsx";
import { Card } from "../../../components/ui/Card.jsx";
import { Button } from "../../../components/ui/Button.jsx";

export function RequestDetailsPage({ textLink, activeRequest, openDecline, approve }) {
  return (
    <>
      <div className="sr-breadcrumb">
        {textLink("Requests", "/staff/requests")}
        <span>/ {activeRequest.name}</span>
      </div>
      <PageHeading
        title="Request details"
        description={`${activeRequest.name} · ${activeRequest.studentId}`}
        actions={<Status status={activeRequest.status} />}
      />
      <Card className="sr-request-details">
        <h2>Pickup request</h2>
        <dl>
          <div>
            <dt>Student</dt>
            <dd>{activeRequest.name}</dd>
          </div>
          <div>
            <dt>Student ID</dt>
            <dd>{activeRequest.studentId}</dd>
          </div>
          <div>
            <dt>Pickup</dt>
            <dd>{activeRequest.pickup}</dd>
          </div>
          <div>
            <dt>Sent</dt>
            <dd>{activeRequest.sent}</dd>
          </div>
          {activeRequest.foodName && (
            <div>
              <dt>Requested food</dt>
              <dd>{activeRequest.foodName}</dd>
            </div>
          )}
          <div>
            <dt>Note</dt>
            <dd>{activeRequest.note || "No dietary notes"}</dd>
          </div>
          <div>
            <dt>ID card</dt>
            <dd>{activeRequest.firstVisit ? "First visit — check at pickup" : "Checked"}</dd>
          </div>
        </dl>
        {activeRequest.declineReason && (
          <div className="notice">
            <strong>Reason for declining</strong>
            <p>{activeRequest.declineReason}</p>
          </div>
        )}
        {activeRequest.status === "Waiting" && (
          <div className="sr-detail-actions">
            <Button
              variant="secondary"
              className="sr-decline-button"
              onClick={() => openDecline(activeRequest)}
            >
              Decline
            </Button>
            <Button asyncAction loadingLabel="Approving…" onClick={() => approve(activeRequest)}>
              Approve request
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}
