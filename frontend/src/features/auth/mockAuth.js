// Browser-only demo authentication; replace with the backend session API later.
import { readMockValue, persistMockValue } from "../../lib/mockStorage.js";
import { mergeAdminUsers, matchesEmail } from "../admin/users/model.js";
import { adminUsersKey, initialAdminUsers } from "../admin/users/data.js";
import { mockPassword, mockAccounts } from "./data.js";

const key = "panther-mock-accounts";

function readAccounts() {
  return readMockValue(key, []);
}

async function passwordDigest(email, password) {
  const bytes = new TextEncoder().encode(`${email}\0${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signInMock(role, email, password) {
  const accounts = readAccounts();
  const users = mergeAdminUsers(readMockValue(adminUsersKey, initialAdminUsers), [], accounts);
  const managed = users.find((user) => matchesEmail(user, email));
  const account = accounts.find((user) => user.email === email);
  const passwordMatches = account
    ? account.passwordDigest === (await passwordDigest(email, password))
    : managed && password === mockPassword;
  if (!managed || !passwordMatches || managed.role !== role)
    throw new Error(
      "Email or password is incorrect for this portal. You can use the sample account below.",
    );
  if (!managed.active) throw new Error("This account is inactive. Contact a pantry administrator.");
  persistMockValue(
    adminUsersKey,
    users.map((user) =>
      user.id === managed.id ? { ...user, lastSignIn: new Date().toISOString() } : user,
    ),
  );
  return {
    name: managed.name,
    email,
    role: managed.role,
    ...(managed.studentId ? { studentId: managed.studentId } : {}),
    demo: true,
  };
}

export async function registerMock({ name, studentId, email, password }) {
  const accounts = readAccounts();
  const managedUsers = readMockValue(adminUsersKey, initialAdminUsers);
  if (managedUsers.some((user) => user.studentId === studentId && !user.active))
    throw new Error("This account is inactive. Contact a pantry administrator.");
  if (
    managedUsers.some(
      (user) => matchesEmail(user, email) || (user.email && user.studentId === studentId),
    ) ||
    Object.values(mockAccounts).some(
      (account) => account.email === email || account.studentId === studentId,
    ) ||
    accounts.some((account) => account.email === email || account.studentId === studentId)
  ) {
    throw new Error("An account with this email or student ID already exists. Sign in instead.");
  }
  const profile = { name, studentId, email, role: "student", demo: true };
  const account = {
    ...profile,
    passwordDigest: await passwordDigest(email, password),
  };
  persistMockValue(key, [...accounts, account]);
  persistMockValue(adminUsersKey, mergeAdminUsers(managedUsers, [], [...accounts, account]));
  return profile;
}
