import { Modal } from "../../../components/ui/Modal.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { AsyncForm } from "../../../components/ui/AsyncForm.jsx";
import { notifyError } from "../../../components/Notifications.jsx";
import { staffCandidate } from "./model.js";
import { Field } from "../../../components/ui/Field.jsx";

// Accounts are created by signing up; admins then grant staff access to that account.
export function AddStaff({ accounts, onClose, onSave }) {
  return (
    <Modal
      title="Add staff member"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="admin-add-staff" type="submit" loadingLabel="Giving access…">
            Give staff access
          </Button>
        </>
      }
    >
      <AsyncForm
        id="admin-add-staff"
        className="stack"
        onSubmit={(event, data) => {
          event.preventDefault();
          const { account, error } = staffCandidate(accounts, data.get("email"));
          if (error) {
            notifyError(error);
            return;
          }
          return onSave(account);
        }}
      >
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
          The staff member first creates their own account on the sign-up page with this email.
          Giving staff access lets them use the Staff sign-in; you can change it later on this page.
        </p>
      </AsyncForm>
    </Modal>
  );
}
