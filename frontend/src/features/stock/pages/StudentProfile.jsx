import { useState } from "react";
import { LinkButton } from "../components/LinkButton.jsx";
import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { Card } from "../../../components/ui/Card.jsx";
import { Badge } from "../../../components/ui/Badge.jsx";
import { Asset } from "../components/Asset.jsx";
import checkIcon from "../../../assets/stock-check.svg";
import { CheckStudent } from "../components/CheckStudent.jsx";
import { verifyStudentId } from "../../../api/operations.js";
import { affected } from "../../../api/keys.js";
import { useRefresh } from "../../../lib/queryClient.js";
import { StudentPhotoCheck } from "../../../components/AccountAvatar.jsx";

export function StudentProfile({ student, navigate, notify }) {
  const refresh = useRefresh();
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
        description={student.studentId || "No student ID yet"}
        actions={!student.idVerified && <Button onClick={() => setChecking(true)}>Check ID</Button>}
      />
      <Card className="stock-profile">
        <h2>Student profile</h2>
        {!student.provisional && (
          <StudentPhotoCheck
            profileId={student.id}
            name={student.name}
            className="stock-profile-photo"
          />
        )}
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
              {student.idVerified ? (
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
          onSave={async () => {
            await verifyStudentId(student);
            await refresh(affected.students);
            setChecking(false);
            notify("Student ID check recorded.");
          }}
        />
      )}
    </>
  );
}
