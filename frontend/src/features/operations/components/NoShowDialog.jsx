import { Modal } from "../../../components/ui/Modal.jsx";
import { Button } from "../../../components/ui/Button.jsx";

export function NoShowDialog({ setNoShowPickup, setPickups, noShowPickup, setRequests, notify }) {
  return (
    <Modal
      title="Mark this pickup as a no-show?"
      onClose={() => setNoShowPickup(null)}
      footer={
        <>
          <Button variant="secondary" onClick={() => setNoShowPickup(null)}>
            Go back
          </Button>
          <Button
            variant="danger"
            asyncAction
            loadingLabel="Saving…"
            onClick={() => {
              setPickups((current) =>
                current.map((p) => (p.id === noShowPickup.id ? { ...p, status: "No-show" } : p)),
              );
              setRequests((current) =>
                current.map((r) => (r.id === noShowPickup.id ? { ...r, status: "No-show" } : r)),
              );
              notify(`${noShowPickup.name} marked as a no-show.`);
              setNoShowPickup(null);
            }}
          >
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
