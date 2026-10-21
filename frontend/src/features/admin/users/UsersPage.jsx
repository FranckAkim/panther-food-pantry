import { usePersistedState } from "../../../hooks/usePersistedState.js";
import { adminUsersKey, initialAdminUsers } from "./data.js";
import { initialStudents } from "../../stock/data/students.js";
import { useMemo, useState } from "react";
import { mergeAdminUsers, validateUserChange, matchesEmail, roleLabel } from "./model.js";
import { usePendingAction } from "../../../components/loading/ActionContext.js";
import { notifyError } from "../../../components/Notifications.jsx";
import { localDate } from "../../../lib/dates.js";
import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import addStaffIcon from "../../../assets/stock-add-student.svg";
import { Search } from "../components/Search.jsx";
import { DataLoader } from "../../../components/loading/DataLoader.jsx";
import { Badge } from "../../../components/ui/Badge.jsx";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";
import { AddStaff } from "./AddStaffDialog.jsx";
import { UserChangeDialog } from "./UserChangeDialog.jsx";

export function Users({ profile, notify }) {
  const [storedUsers, setUsers] = usePersistedState(adminUsersKey, initialAdminUsers);
  const [students] = usePersistedState("panther-students-v1", initialStudents);
  const [accounts] = usePersistedState("panther-mock-accounts", []);
  const users = useMemo(
    () => mergeAdminUsers(storedUsers, students, accounts),
    [storedUsers, students, accounts],
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [adding, setAdding] = useState(false);
  const [change, setChange] = useState(null);
  const [studentId, setStudentId] = useState("");
  const [roleEmail, setRoleEmail] = useState("");
  const { pending } = usePendingAction();
  const filtered = users.filter(
    (user) =>
      (filter === "All" ||
        user.role === { Students: "student", Staff: "staff", Admins: "admin" }[filter]) &&
      `${user.name} ${user.email} ${user.studentId || ""} ${(user.aliases || []).join(" ")}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  function saveChange(event) {
    event.preventDefault();
    const patch =
      change.patch.role === "student"
        ? { ...change.patch, studentId: studentId.trim().toUpperCase() }
        : change.patch;
    if (change.patch.role && change.patch.role !== "student" && !change.user.email)
      patch.email = roleEmail.trim().toLowerCase();
    let saved = false;
    setUsers((current) => {
      const all = mergeAdminUsers(current, students, accounts);
      const target = all.find((user) => user.id === change.user.id);
      const error = validateUserChange(all, target, patch, profile.email);
      if (error) {
        notifyError(error);
        return current;
      }
      saved = true;
      return all.map((user) => (user.id === target.id ? { ...user, ...patch } : user));
    });
    if (saved) {
      notify(`${change.user.name}'s account updated.`);
      setChange(null);
    }
  }
  const lastSignIn = (user) =>
    !user.lastSignIn
      ? "Never"
      : localDate(user.lastSignIn) === localDate(new Date())
        ? "Today"
        : new Date(user.lastSignIn).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "America/Chicago",
          });
  return (
    <>
      <PageHeading
        title="Users"
        description="Who can sign in, and what they can do."
        actions={
          <Button onClick={() => setAdding(true)}>
            <img src={addStaffIcon} width="20" height="20" alt="" />
            Add staff member
          </Button>
        }
      />
      <div className="admin-toolbar">
        <Search value={query} onChange={setQuery} placeholder="Search name or email" />
        <div className="admin-filters" role="group" aria-label="Filter users by role">
          {["All", "Students", "Staff", "Admins"].map((role) => (
            <button
              type="button"
              key={role}
              className={`admin-filter${filter === role ? " is-selected" : ""}`}
              aria-pressed={filter === role}
              onClick={() => setFilter(role)}
            >
              {role}
            </button>
          ))}
        </div>
      </div>
      <DataLoader
        queryKey={JSON.stringify([query, filter])}
        initialLoading={false}
        label="Loading users…"
      >
        <div className="table-wrap">
          <table className="data-table admin-users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last sign-in</th>
                <th>
                  <span className="admin-sr-only">Account actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const self = matchesEmail(user, profile.email);
                return (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name}</strong>
                      {self && <span className="muted"> (you)</span>}
                      {user.provisional ? (
                        <small>Provisional profile</small>
                      ) : (
                        !user.email && <small>No sign-in account</small>
                      )}
                    </td>
                    <td className="muted">{user.email || "—"}</td>
                    <td>
                      {self ? (
                        roleLabel(user.role)
                      ) : (
                        <select
                          className="select admin-role"
                          aria-label={`Role for ${user.name}`}
                          disabled={!!pending}
                          value={user.role}
                          onChange={(event) => {
                            setStudentId(user.studentId || "");
                            setRoleEmail(user.email || "");
                            setChange({
                              user,
                              patch: { role: event.target.value },
                            });
                          }}
                        >
                          <option value="student">Student</option>
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                    </td>
                    <td>
                      <Badge tone={user.active ? "success" : "neutral"}>
                        {user.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="muted">{lastSignIn(user)}</td>
                    <td>
                      {!self && (
                        <button
                          type="button"
                          disabled={!!pending}
                          className={`admin-text-action${user.active ? " admin-deactivate" : ""}`}
                          onClick={() => setChange({ user, patch: { active: !user.active } })}
                        >
                          {user.active ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && (
            <EmptyState title="No users found" description="Try another name, email, or role." />
          )}
        </div>
      </DataLoader>
      {adding && (
        <AddStaff
          users={users}
          onClose={() => setAdding(false)}
          onSave={(user) => {
            let saved = false;
            setUsers((current) => {
              const all = mergeAdminUsers(current, students, accounts);
              if (all.some((existing) => matchesEmail(existing, user.email))) {
                notifyError("An account with this email already exists.");
                return current;
              }
              saved = true;
              return [...all, user];
            });
            if (saved) {
              setAdding(false);
              notify(`${user.name}'s mock staff account is ready.`);
            }
          }}
        />
      )}
      {change && (
        <UserChangeDialog
          change={change}
          setChange={setChange}
          saveChange={saveChange}
          studentId={studentId}
          setStudentId={setStudentId}
          roleEmail={roleEmail}
          setRoleEmail={setRoleEmail}
        />
      )}
    </>
  );
}
