import { Card } from "../../../components/ui/Card.jsx";
import { Badge } from "../../../components/ui/Badge.jsx";
import { Button } from "../../../components/ui/Button.jsx";

export function RequestStatusCard({ open, setCancelRequest }) {
  return (
    <Card className="student-request-status">
      <div className="student-section-title">
        <h2>
          {open.status === "Approved"
            ? "Your pickup is confirmed"
            : "Your request is waiting for approval"}
        </h2>
        <Badge tone={open.status === "Approved" ? "success" : "warning"}>
          {open.status === "Waiting" ? "Submitted" : open.status}
        </Badge>
      </div>
      <p className="muted">
        {open.status === "Approved"
          ? "Bring your student ID card when you pick up your food."
          : "Staff will review your request. Check back here for an update."}
      </p>
      <div className="student-pickup-info">
        {open.foodName && (
          <div>
            <span>Requested food</span>
            <strong>{open.foodName}</strong>
          </div>
        )}
        <div>
          <span>Pickup day</span>
          <strong>{open.fullPickupDate}</strong>
        </div>
        <div>
          <span>Pickup time</span>
          <strong>{open.slot}</strong>
        </div>
      </div>
      {open.note && (
        <p>
          <strong>Dietary note:</strong> {open.note}
        </p>
      )}
      <Button variant="secondary" onClick={() => setCancelRequest(open)}>
        Cancel request
      </Button>
    </Card>
  );
}
