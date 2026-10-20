import { Modal } from "../../../components/ui/Modal.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { AsyncForm } from "../../../components/ui/AsyncForm.jsx";
import { notifyError } from "../../../components/Notifications.jsx";
import { dateText, today } from "../utils/formatters.js";
import { Field } from "../../../components/ui/Field.jsx";

export function CreateStudent({ students, onClose, onSave }) {
  return (
    <Modal
      title="Help a student sign up"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loadingLabel="Saving…" type="submit" form="stock-create-student">
            Create profile
          </Button>
        </>
      }
    >
      <AsyncForm
        id="stock-create-student"
        className="stack"
        onSubmit={(e, formData) => {
          e.preventDefault();
          const data = formData;
          const studentId = data.get("studentId").trim().toUpperCase();
          if (students.some((s) => s.id === studentId)) {
            notifyError(
              "A profile with this student ID already exists. Search for their existing profile.",
            );
            return;
          }
          onSave({
            name: data.get("name").trim(),
            id: studentId,
            provisional: true,
            checked: data.get("checked") ? dateText(today(), false) : "",
            lastPickup: "—",
            request: "",
          });
        }}
      >
        <p className="muted">
          Create a provisional profile so the student can receive food. When they sign up using the
          same student ID, their pickups can be linked to their account.
        </p>
        <Field label="Full name">
          <input className="input" name="name" required />
        </Field>
        <Field label="Student ID number">
          <input
            className="input"
            name="studentId"
            placeholder="P00987654"
            pattern="[Pp][0-9]{8}"
            title="Use P followed by eight digits."
            required
          />
        </Field>
        <label className="stock-check-label">
          <input type="checkbox" name="checked" />I checked the student's ID card
        </label>
      </AsyncForm>
    </Modal>
  );
}
