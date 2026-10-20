import { Modal } from "../../../components/ui/Modal.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { AsyncForm } from "../../../components/ui/AsyncForm.jsx";

export function CheckStudent({ student, onClose, onSave }) {
  return (
    <Modal
      title="Check student ID"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="stock-check-id" loadingLabel="Saving…" type="submit">
            Save ID check
          </Button>
        </>
      }
    >
      <AsyncForm
        id="stock-check-id"
        className="stack"
        onSubmit={(e, formData) => {
          e.preventDefault();
          onSave();
        }}
      >
        <p>Match the name and student ID on the student's card.</p>
        <div className="stock-id-preview">
          <strong>{student.name}</strong>
          <span>{student.id}</span>
        </div>
        <label className="stock-check-label">
          <input type="checkbox" required />I checked the student ID card
        </label>
      </AsyncForm>
    </Modal>
  );
}
