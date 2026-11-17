import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { directoryUsers, validateAccessChange, roleLabel } from "./model.js";
import { fetchAccounts, fetchStudents, setAccess } from "../../../api/operations.js";
import { affected, keys } from "../../../api/keys.js";
import { useRefresh } from "../../../lib/queryClient.js";
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
import { AccountAvatar } from "../../../components/AccountAvatar.jsx";

export function Users({ profile, notify }) {
  const refresh = useRefresh();
  const accountsQuery = useQuery({ queryKey: keys.accounts, queryFn: fetchAccounts });
  const studentsQuery = useQuery({ queryKey: keys.students, queryFn: fetchStudents });
  const accounts = useMemo(() => accountsQuery.data || [], [accountsQuery.data]);
  const users = useMemo(
    () => directoryUsers(accounts, studentsQuery.data || []),
    [accounts, studentsQuery.data],
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [adding, setAdding] = useState(false);
  const [change, setChange] = useState(null);
  const { pending } = usePendingAction();
  const filtered = users.filter(
    (user) =>
      (filter === "All" ||
        user.role === { Students: "student", Staff: "staff", Admins: "admin" }[filter]) &&
      `${user.name} ${user.email} ${user.studentId || ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  async function saveChange(event) {
    event.preventDefault();
    const target = users.find((user) => user.id === change.user.id);
    const error = validateAccessChange(users, target, change.patch, profile.id);
    if (error) {
      notifyError(error);
      return;
    }
    await setAccess(
      target.id,
      change.patch.role ?? target.role,
      change.patch.active ?? target.active,
    );
    await refresh(affected.accounts);
    notify(`${change.user.name}'s account updated.`);
    setChange(null);
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
      <DataLoader queries={[accountsQuery, studentsQuery]} label="Loading users…">
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
                const self = user.id === profile.id;
                return (
                  <tr key={user.id}>
                    <td>
                      <div className="person-cell">
                        <AccountAvatar
                          profileId={user.provisional ? null : user.id}
                          name={user.name}
                        />
                        <div>
                          <strong>{user.name}</strong>
                          {self && <span className="muted"> (you)</span>}
                          {user.provisional ? (
                            <small>Provisional profile</small>
                          ) : (
                            !user.email && <small>No sign-in account</small>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="muted">{user.email || "—"}</td>
                    <td>
                      {self || user.provisional ? (
                        roleLabel(user.role)
                      ) : (
                        <select
                          className="select admin-role"
                          aria-label={`Role for ${user.name}`}
                          disabled={!!pending}
                          value={user.role}
                          onChange={(event) => {
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
                      {!self && !user.provisional && (
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
          accounts={accounts}
          onClose={() => setAdding(false)}
          onSave={async (account) => {
            await setAccess(account.id, "staff", true);
            await refresh(affected.accounts);
            setAdding(false);
            notify(`${account.name} now has staff access.`);
          }}
        />
      )}
      {change && <UserChangeDialog change={change} setChange={setChange} saveChange={saveChange} />}
    </>
  );
}
