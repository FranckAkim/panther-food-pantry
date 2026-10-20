import { Modal } from "../../../components/ui/Modal.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { AsyncForm } from "../../../components/ui/AsyncForm.jsx";
import { roleLabel } from "./model.js";
import { Field } from "../../../components/ui/Field.jsx";

export function UserChangeDialog({
  change,
  setChange,
  saveChange,
  studentId,
  setStudentId,
  roleEmail,
  setRoleEmail,
}) {
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
          <Field label="Student ID">
            <input
              className="input"
              required
              pattern="[Pp][0-9]{8}"
              placeholder="P followed by eight numbers"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
            />
          </Field>
        )}
        {change.patch.role && change.patch.role !== "student" && !change.user.email && (
          <Field label="Campus email">
            <input
              className="input"
              type="email"
              required
              placeholder="name@pvamu.edu"
              value={roleEmail}
              onChange={(event) => setRoleEmail(event.target.value)}
            />
          </Field>
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
