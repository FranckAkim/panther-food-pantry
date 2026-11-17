import { useState } from "react";
import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { Asset } from "../components/Asset.jsx";
import addStudentIcon from "../../../assets/stock-add-student.svg";
import { Search } from "../components/Search.jsx";
import { Filter } from "../components/Filter.jsx";
import { StockTable } from "../components/StockTable.jsx";
import { Badge } from "../../../components/ui/Badge.jsx";
import checkIcon from "../../../assets/stock-check.svg";
import { LinkButton } from "../components/LinkButton.jsx";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";
import { CreateStudent } from "../components/CreateStudent.jsx";
import { CheckStudent } from "../components/CheckStudent.jsx";
import { createProvisionalStudent, verifyStudentId } from "../../../api/operations.js";
import { affected } from "../../../api/keys.js";
import { useRefresh } from "../../../lib/queryClient.js";
import { AccountAvatar } from "../../../components/AccountAvatar.jsx";

export function Students({ students, showStudent, notify }) {
  const refresh = useRefresh();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(null);
  const filtered = students.filter(
    (s) =>
      `${s.name} ${s.studentId}`.toLowerCase().includes(query.trim().toLowerCase()) &&
      (filter === "all" || (filter === "unchecked" ? !s.idVerified : s.provisional)),
  );
  return (
    <>
      <PageHeading
        title="Students"
        description="Check ID cards and help students sign up."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Asset src={addStudentIcon} />
            Help a student sign up
          </Button>
        }
      />
      <div className="stock-toolbar">
        <Search value={query} onChange={setQuery} placeholder="Search name or student ID" />
        <div className="stock-filters" role="group" aria-label="Filter students">
          <Filter selected={filter === "all"} onClick={() => setFilter("all")}>
            All
          </Filter>
          <Filter selected={filter === "unchecked"} onClick={() => setFilter("unchecked")}>
            ID not checked · {students.filter((s) => !s.idVerified).length}
          </Filter>
          <Filter selected={filter === "provisional"} onClick={() => setFilter("provisional")}>
            Provisional · {students.filter((s) => s.provisional).length}
          </Filter>
        </div>
      </div>
      <>
        <StockTable className="stock-student-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Student ID</th>
              <th>Account</th>
              <th>ID card</th>
              <th>Last pickup</th>
              <th>Open request</th>
              <th>
                <span className="stock-sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((student) => (
              <tr key={student.id}>
                <td className="stock-medium">
                  <span className="person-cell">
                    <AccountAvatar
                      profileId={student.provisional ? null : student.id}
                      name={student.name}
                    />
                    {student.name}
                  </span>
                </td>
                <td className="muted">{student.studentId || "—"}</td>
                <td>
                  {student.provisional ? <Badge tone="neutral">Provisional</Badge> : "Has account"}
                </td>
                <td>
                  {student.idVerified ? (
                    <span className="stock-checked">
                      <Asset src={checkIcon} />
                      Checked {student.checked}
                    </span>
                  ) : (
                    <Badge tone="warning">Not checked</Badge>
                  )}
                </td>
                <td className="muted">{student.lastPickup}</td>
                <td>
                  {student.request ? (
                    <Badge tone={student.request === "Approved" ? "info" : "warning"}>
                      {student.request}
                    </Badge>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="stock-student-action">
                  {student.idVerified ? (
                    <LinkButton onClick={() => showStudent(student.id)}>View</LinkButton>
                  ) : (
                    <Button variant="secondary" onClick={() => setChecking(student)}>
                      Check ID
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </StockTable>
        {!filtered.length && (
          <EmptyState
            title="No students found"
            description="Try another name, student ID, or filter."
          />
        )}
      </>
      {creating && (
        <CreateStudent
          students={students}
          onClose={() => setCreating(false)}
          onSave={async (student) => {
            await createProvisionalStudent(student);
            await refresh(affected.students);
            setCreating(false);
            notify(`${student.name}'s provisional profile was created.`);
          }}
        />
      )}
      {checking && (
        <CheckStudent
          student={checking}
          onClose={() => setChecking(null)}
          onSave={async () => {
            await verifyStudentId(checking);
            await refresh(affected.students);
            setChecking(null);
            notify("Student ID check recorded.");
          }}
        />
      )}
    </>
  );
}
