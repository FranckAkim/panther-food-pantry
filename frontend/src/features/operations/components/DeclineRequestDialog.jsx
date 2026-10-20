import { Modal } from "../../../components/ui/Modal.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { Field } from "../../../components/ui/Field.jsx";

export function DeclineRequestDialog({ setDeclining, decline, declining, reason, setReason }) {
  return (
    <Modal
      title="Decline this request?"
      onClose={() => {
        setDeclining(null);
      }}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              setDeclining(null);
            }}
          >
            Go back
          </Button>
          <Button variant="danger" asyncAction loadingLabel="Declining…" onClick={decline}>
            Decline request
          </Button>
        </>
      }
    >
      <div className="sr-decline-dialog">
        <p className="muted">
          {declining.name} · {declining.pickup}
        </p>
        <Field label="Reason (required)" hint="The student will see this reason.">
          <textarea
            className="textarea"
            rows="3"
            autoFocus
            required
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
            }}
            placeholder="e.g. That pickup time is full. Please choose another time."
          />
        </Field>
      </div>
    </Modal>
  );
}
