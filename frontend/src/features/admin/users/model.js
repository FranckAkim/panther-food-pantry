export const roleLabel = (role) =>
  ({ student: "Student", staff: "Staff", admin: "Admin" })[role] || role;

export const matchesEmail = (user, email = "") =>
  [user.email, ...(user.aliases || [])].some(
    (value) => value && value.toLowerCase() === email.toLowerCase(),
  );

export function mergeAdminUsers(users, students = [], accounts = []) {
  const merged = users.map((user) => ({ ...user }));
  for (const account of accounts) {
    const existing = merged.find(
      (user) =>
        matchesEmail(user, account.email) ||
        (account.studentId && user.studentId === account.studentId),
    );
    if (existing) {
      if (!existing.email) existing.email = account.email;
      else if (!matchesEmail(existing, account.email))
        existing.aliases = [...(existing.aliases || []), account.email];
      existing.provisional = false;
    } else
      merged.push({
        id: account.studentId || account.email,
        name: account.name,
        email: account.email,
        studentId: account.studentId,
        role: account.role,
        active: true,
        lastSignIn: null,
      });
  }
  for (const student of students) {
    if (!merged.some((user) => user.studentId === student.id))
      merged.push({
        id: `student-${student.id}`,
        studentId: student.id,
        name: student.name,
        email: student.email || "",
        role: "student",
        active: true,
        provisional: Boolean(student.provisional),
        lastSignIn: null,
      });
  }
  return merged;
}

export function validateUserChange(users, target, patch, actorEmail) {
  if (!target) return "This user no longer exists.";
  if (matchesEmail(target, actorEmail))
    return "You cannot change your own role or deactivate your own account.";
  if (patch.role && !["student", "staff", "admin"].includes(patch.role))
    return "Choose a valid role.";
  if (
    target.role === "admin" &&
    target.active &&
    (patch.active === false || (patch.role && patch.role !== "admin")) &&
    users.filter((user) => user.role === "admin" && user.active).length <= 1
  )
    return "Keep at least one active admin account.";
  if (patch.role && patch.role !== "student") {
    const email = patch.email || target.email;
    if (!/^[^\s@]+@pvamu\.edu$/.test(email || ""))
      return "Enter a campus email address for this account.";
    if (users.some((user) => user.id !== target.id && matchesEmail(user, email)))
      return "An account with this email already exists.";
  }
  if (patch.role === "student") {
    const studentId = patch.studentId || target.studentId;
    if (!/^P\d{8}$/.test(studentId || ""))
      return "Enter a student ID: P followed by eight numbers.";
    if (users.some((user) => user.id !== target.id && user.studentId === studentId))
      return "That student ID belongs to another user.";
  }
  return "";
}
