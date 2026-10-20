import { useState } from "react";
import { LinkButton } from "../components/LinkButton.jsx";
import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { Card } from "../../../components/ui/Card.jsx";
import { Badge } from "../../../components/ui/Badge.jsx";
import { Asset } from "../components/Asset.jsx";
import checkIcon from "../../../assets/stock-check.svg";
import { CheckStudent } from "../components/CheckStudent.jsx";
import { dateText, today } from "../utils/formatters.js";

export function StudentProfile({ student, setStudents, navigate, notify }) {
  const [checking, setChecking] = useState(false);
  return (
    <>
      <div className="stock-breadcrumb">
        <LinkButton underline onClick={() => navigate("/staff/students")}>
          Students
        </LinkButton>
        <span>/ {student.name}</span>
      </div>
      <PageHeading
        title={student.name}
        description={student.id}
        actions={!student.checked && <Button onClick={() => setChecking(true)}>Check ID</Button>}
      />
      <Card className="stock-profile">
        <h2>Student profile</h2>
        <dl>
          <div>
            <dt>Account</dt>
            <dd>
              {student.provisional ? <Badge tone="neutral">Provisional</Badge> : "Has account"}
            </dd>
          </div>
          <div>
            <dt>ID card</dt>
            <dd>
              {student.checked ? (
                <span className="stock-checked">
                  <Asset src={checkIcon} />
                  Checked {student.checked}
                </span>
              ) : (
                <Badge tone="warning">Not checked</Badge>
              )}
            </dd>
          </div>
          <div>
            <dt>Last pickup</dt>
            <dd>{student.lastPickup}</dd>
          </div>
          <div>
            <dt>Open request</dt>
            <dd>
              {student.request ? (
                <Badge tone={student.request === "Approved" ? "info" : "warning"}>
                  {student.request}
                </Badge>
              ) : (
                "No open request"
              )}
            </dd>
          </div>
        </dl>
        {student.provisional && (
          <p className="notice">
            If the student signs up later with this student ID, their pickups can be linked to the
            new account.
          </p>
        )}
      </Card>
      <div className="stock-actions">
        <Button variant="secondary" onClick={() => navigate("/staff/students")}>
          Back to students
        </Button>
        <Button onClick={() => navigate("/staff/walk-in")}>Record a walk-in</Button>
      </div>
      {checking && (
        <CheckStudent
          student={student}
          onClose={() => setChecking(false)}
          onSave={() => {
            setStudents((old) =>
              old.map((s) =>
                s.id === student.id ? { ...s, checked: dateText(today(), false) } : s,
              ),
            );
            setChecking(false);
            notify("Student ID check recorded.");
          }}
        />
      )}
    </>
  );
}
