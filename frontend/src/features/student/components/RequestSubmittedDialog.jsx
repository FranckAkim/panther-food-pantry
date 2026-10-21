import { Modal } from "../../../components/ui/Modal.jsx";
import { Button } from "../../../components/ui/Button.jsx";

export function RequestSubmittedDialog({ setSubmitted, submitted }) {
  return (
    <Modal
      title="Request submitted"
      onClose={() => setSubmitted(null)}
      footer={<Button onClick={() => setSubmitted(null)}>Done</Button>}
    >
      <div className="student-success">
        <span className="student-success-mark" aria-hidden="true">
          ✓
        </span>
        <p>
          Your request for <strong>{submitted.foodName}</strong> has been sent to pantry staff.
        </p>
        <p className="muted">
          {submitted.fullPickupDate} · {submitted.slot}
        </p>
        <p>Check your home page for approval and pickup updates.</p>
      </div>
    </Modal>
  );
}
