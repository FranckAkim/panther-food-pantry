import { Modal } from "../../../components/ui/Modal.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { AsyncForm } from "../../../components/ui/AsyncForm.jsx";
import { roleLabel } from "./model.js";

export function UserChangeDialog({ change, setChange, saveChange }) {
  return (
    <Modal
      title={
        change.patch.role
          ? "Change user role"
          : `${change.patch.active ? "Activate" : "Deactivate"} account`
      }
      onClose={() => setChange(null)}
      footer={
        <>
          <Button variant="secondary" onClick={() => setChange(null)}>
            Cancel
          </Button>
          <Button type="submit" form="admin-user-change" loadingLabel="Saving…">
            {change.patch.role
              ? "Save role"
              : change.patch.active
                ? "Activate account"
                : "Deactivate account"}
          </Button>
        </>
      }
    >
      <AsyncForm id="admin-user-change" className="stack" onSubmit={saveChange}>
        <p>
          {change.patch.role ? (
            <>
              Change <strong>{change.user.name}</strong> from {roleLabel(change.user.role)} to{" "}
              <strong>{roleLabel(change.patch.role)}</strong>?
            </>
          ) : change.patch.active ? (
            <>
              <strong>{change.user.name}</strong> will be able to sign in again.
            </>
          ) : (
            <>
              <strong>{change.user.name}</strong> will no longer be able to sign in. Their records
              will be kept.
            </>
          )}
        </p>
        {change.patch.role === "student" && (
          <p className="muted">
            They keep their account and history. Staff check their student ID at their next pickup.
          </p>
        )}
        {change.patch.role === "admin" && (
          <p className="muted">
            Admins can manage accounts, view reports, and review the audit log.
          </p>
        )}
      </AsyncForm>
    </Modal>
  );
}
