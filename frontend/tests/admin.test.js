import { test } from "node:test";
import assert from "node:assert/strict";
import {
  directoryUsers,
  staffCandidate,
  validateAccessChange,
} from "../src/features/admin/users/model.js";
import { reportCsv } from "../src/features/admin/reports/model.js";

const accounts = [
  { id: "a1", name: "Ada Admin", email: "ada@pvamu.edu", role: "admin", active: true },
  { id: "s1", name: "Sam Staff", email: "sam@pvamu.edu", role: "staff", active: true },
  { id: "u1", name: "Stu One", email: "stu@pvamu.edu", role: "student", active: true },
];

test("self edits, walk-in profiles, and removing the last active admin are blocked", () => {
  const users = directoryUsers(accounts, [
    { id: "w1", name: "Walk In", studentId: "P12345678", provisional: true },
    { id: "u1", name: "Stu One", studentId: "P00000001", provisional: false },
  ]);
  assert.equal(users.length, 4, "accounts plus provisional students, without duplicates");
  const find = (id) => users.find((user) => user.id === id);
  assert.match(validateAccessChange(users, find("a1"), { role: "staff" }, "a1"), /your own/);
  assert.match(
    validateAccessChange(users, find("a1"), { active: false }, "s1"),
    /at least one active admin/,
  );
  assert.match(
    validateAccessChange(users, find("w1"), { role: "staff" }, "a1"),
    /no sign-in account/,
  );
  assert.equal(validateAccessChange(users, find("u1"), { role: "staff" }, "a1"), "");
  const twoAdmins = [...users, { id: "a2", role: "admin", active: true }];
  assert.equal(validateAccessChange(twoAdmins, find("a1"), { active: false }, "a2"), "");
});

test("staff access is given only to an existing student account with a campus email", () => {
  assert.match(staffCandidate(accounts, "someone@gmail.com").error, /@pvamu\.edu/);
  assert.match(staffCandidate(accounts, "new@pvamu.edu").error, /No account uses this email/);
  assert.match(staffCandidate(accounts, "sam@pvamu.edu").error, /already has Staff access/);
  assert.equal(staffCandidate(accounts, " STU@pvamu.edu ").account.id, "u1");
});

test("CSV exports the month's aggregates and escapes unsafe cells", () => {
  const report = {
    students: 12,
    completed: 20,
    units: 340,
    donations: 3,
    expired: 4,
    results: [
      ["Completed", 20],
      ["No-show", 2],
      ["Cancelled", 1],
      ["Declined", 1],
    ],
    items: [['=formula,"quoted"', 9]],
  };
  const csv = reportCsv("2026-11", report);
  assert.ok(csv.startsWith("﻿"), "Excel-friendly byte order mark");
  assert.match(csv, /"2026-11","Summary","Units handed out","340"/);
  assert.match(csv, /"2026-11","Requests by result","Completed","20","83%"/);
  assert.ok(csv.includes("'="), "formula-like cells are neutralized");
  assert.ok(csv.includes('""quoted""'));
});
