export const roleLabel = (role) =>
  ({ student: "Student", staff: "Staff", admin: "Admin" })[role] || role;

/** Accounts plus walk-in (provisional) students, who have no sign-in account. */
export function directoryUsers(accounts = [], students = []) {
  return [
    ...accounts,
    ...students
      .filter((student) => student.provisional)
      .map((student) => ({
        id: student.id,
        name: student.name,
        email: "",
        studentId: student.studentId,
        role: "student",
        active: true,
        provisional: true,
        lastSignIn: null,
      })),
  ];
}

/**
 * Checks an access change before sending it. The database enforces the same rules;
 * this gives a clear message without a round trip. Returns "" when the change is allowed.
 */
export function validateAccessChange(users, target, patch, actorId) {
  if (!target) return "This user no longer exists.";
  if (target.provisional) return "This student has no sign-in account to change.";
  if (target.id === actorId)
    return "You cannot change your own role or deactivate your own account.";
  if (patch.role && !["student", "staff", "admin"].includes(patch.role))
    return "Choose a valid role.";
  const removesAdmin =
    target.role === "admin" &&
    target.active &&
    (patch.active === false || (patch.role && patch.role !== "admin"));
  if (removesAdmin && users.filter((user) => user.role === "admin" && user.active).length <= 1)
    return "Keep at least one active admin account.";
  return "";
}

/** Finds the account that will receive staff access, or explains why it cannot. */
export function staffCandidate(accounts, email) {
  const address = String(email || "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@pvamu\.edu$/.test(address))
    return { error: "Use a campus email address ending in @pvamu.edu." };
  const account = accounts.find((user) => user.email?.toLowerCase() === address);
  if (!account)
    return {
      error:
        "No account uses this email yet. Ask them to create one on the sign-up page with this email, then add them here.",
    };
  if (account.role !== "student")
    return { error: `${account.name} already has ${roleLabel(account.role)} access.` };
  return { account };
}
