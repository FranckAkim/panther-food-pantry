import { Modal } from "../../../components/ui/Modal.jsx";
import { Button } from "../../../components/ui/Button.jsx";

export function NoShowDialog({ setNoShowPickup, noShowPickup, confirmNoShow }) {
  return (
    <Modal
      title="Mark this pickup as a no-show?"
      onClose={() => setNoShowPickup(null)}
      footer={
        <>
          <Button variant="secondary" onClick={() => setNoShowPickup(null)}>
            Go back
          </Button>
          <Button variant="danger" asyncAction loadingLabel="Saving…" onClick={confirmNoShow}>
            Mark no-show
          </Button>
        </>
      }
    >
      <p>
        {noShowPickup.name} has not picked up their food for the {noShowPickup.slot} slot.
      </p>
    </Modal>
  );
}
