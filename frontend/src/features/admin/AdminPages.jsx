import { Reports } from "./reports/ReportsPage.jsx";
import { Users } from "./users/UsersPage.jsx";
import { AuditLog } from "./audit/AuditLogPage.jsx";

export function Admin({ page, profile, notify }) {
  return (
    <div className="admin-pages">
      {page === "reports" ? (
        <Reports notify={notify} />
      ) : page === "users" ? (
        <Users profile={profile} notify={notify} />
      ) : (
        <AuditLog />
      )}
    </div>
  );
}
