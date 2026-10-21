import { Modal } from "../../../components/ui/Modal.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { AsyncForm } from "../../../components/ui/AsyncForm.jsx";
import { notifyError } from "../../../components/Notifications.jsx";
import { matchesEmail } from "./model.js";
import { Field } from "../../../components/ui/Field.jsx";
import { mockPassword } from "../../auth/data.js";

export function AddStaff({ users, onClose, onSave }) {
  return (
    <Modal
      title="Add staff member"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="admin-add-staff" type="submit" loadingLabel="Creating account…">
            Add staff member
          </Button>
        </>
      }
    >
      <AsyncForm
        id="admin-add-staff"
        className="stack"
        onSubmit={(event, data) => {
          event.preventDefault();
          const name = String(data.get("name") || "").trim();
          const email = String(data.get("email") || "")
            .trim()
            .toLowerCase();
          if (!name) {
            notifyError("Enter the staff member’s full name.");
            return;
          }
          if (!/^[^\s@]+@pvamu\.edu$/.test(email)) {
            notifyError("Use a campus email address ending in @pvamu.edu.");
            return;
          }
          if (users.some((user) => matchesEmail(user, email))) {
            notifyError("An account with this email already exists.");
            return;
          }
          onSave({
            id: crypto.randomUUID(),
            name,
            email,
            role: "staff",
            active: true,
            lastSignIn: null,
            createdAt: new Date().toISOString(),
          });
        }}
      >
        <Field label="Full name">
          <input className="input" name="name" required maxLength={100} autoComplete="off" />
        </Field>
        <Field label="Campus email">
          <input
            className="input"
            name="email"
            type="email"
            required
            placeholder="name@pvamu.edu"
            autoComplete="off"
          />
        </Field>
        <p className="muted">
          This mock account can sign in through the Staff portal using the demo password{" "}
          <strong>{mockPassword}</strong>.
        </p>
      </AsyncForm>
    </Modal>
  );
}
