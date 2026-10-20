import { Modal } from "../../../components/ui/Modal.jsx";
import { Button } from "../../../components/ui/Button.jsx";

export function CancelRequestDialog({ setCancelRequest, cancel, cancelRequest }) {
  return (
    <Modal
      title="Cancel this request?"
      onClose={() => setCancelRequest(null)}
      footer={
        <>
          <Button variant="secondary" onClick={() => setCancelRequest(null)}>
            Keep request
          </Button>
          <Button variant="danger" asyncAction loadingLabel="Cancelling request…" onClick={cancel}>
            Yes, cancel request
          </Button>
        </>
      }
    >
      <p>
        Your{" "}
        {cancelRequest.foodName ? `request for ${cancelRequest.foodName.toLowerCase()}` : "pickup"}{" "}
        on {cancelRequest.fullPickupDate} at {cancelRequest.slot} will be cancelled. You can choose
        another pickup afterward.
      </p>
    </Modal>
  );
}
