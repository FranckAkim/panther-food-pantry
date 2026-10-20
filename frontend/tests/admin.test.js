import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initialAdminUsers, adminUsersKey, mergeAdminUsers, validateUserChange, buildReport, reportSnapshots, reportCsv, initialAuditLog } from '../src/data/admin.js';
import { auditChanges } from '../src/data/audit.js';
import { signInMock, registerMock, mockPassword } from '../src/data/mockAccounts.js';

const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
globalThis.window = new EventTarget();
beforeEach(() => {
  localStorage.setItem(adminUsersKey, JSON.stringify(initialAdminUsers));
  localStorage.setItem('panther-mock-accounts', '[]');
});
const actor = { name: 'Taylor Brooks', role: 'admin' };
test('self edits and removing the last active admin are blocked', () => {
  assert.match(validateUserChange(initialAdminUsers, initialAdminUsers[0], { active: false }, 'admin@pvamu.edu'), /own account/);
  assert.match(validateUserChange(initialAdminUsers, initialAdminUsers[0], { role: 'staff' }, 'another@pvamu.edu'), /at least one/);
});
test('role changes require valid, unique student IDs or campus emails', () => {
  assert.match(validateUserChange(initialAdminUsers, initialAdminUsers[1], { role: 'student', studentId: 'bad' }, 'admin@pvamu.edu'), /student ID/);
  assert.match(validateUserChange(initialAdminUsers, initialAdminUsers[1], { role: 'student', studentId: initialAdminUsers[4].studentId }, 'admin@pvamu.edu'), /another user/);
  assert.equal(validateUserChange(initialAdminUsers, initialAdminUsers[1], { role: 'admin' }, 'admin@pvamu.edu'), '');
  assert.match(validateUserChange(initialAdminUsers, { id: 'new', role: 'student' }, { role: 'staff' }, 'admin@pvamu.edu'), /campus email/);
});
test('merged users retain role/status overrides and never expose password digests', () => {
  const users = mergeAdminUsers([{ ...initialAdminUsers[4], active: false, role: 'staff' }], [{ id: 'P00281734', name: 'Jordan Ellis' }], [{ studentId: 'P00281734', email: 'jordan@pvamu.edu', passwordDigest: 'secret', role: 'student' }]);
  assert.equal(users.length, 1);
  assert.equal(users[0].role, 'staff');
  assert.equal(users[0].active, false);
  assert.ok(!JSON.stringify(users).includes('secret'));
});
test('audit entries describe successful changes and ignore no-ops', () => {
  const updated = initialAdminUsers.map(user => user.id === 'user-dana' ? { ...user, active: false } : user);
  assert.deepEqual(auditChanges(adminUsersKey, initialAdminUsers, initialAdminUsers, actor), []);
  const entries = auditChanges(adminUsersKey, initialAdminUsers, updated, actor);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].action, 'Account deactivated');
  assert.equal(entries[0].actor, 'Taylor Brooks');
  assert.equal(initialAuditLog.length, 52);
});
test('pantry actions enter the audit log without duplicate donation inventory events', () => {
  const old = [{ id: 'r', name: 'Student', status: 'Waiting' }];
  assert.equal(auditChanges('panther-staff-requests', old, [{ ...old[0], status: 'Approved' }], actor)[0].action, 'Request approved');
  assert.equal(auditChanges('panther-donations-v1', [], [{ id: 'd', donor: 'Donor', lines: 2, units: 5 }], actor)[0].change, '2 lots added · 5 units');
  const item = { id: 'food', name: 'Rice', lots: [], changes: [] };
  assert.deepEqual(auditChanges('panther-inventory-v1', [item], [{ ...item, changes: [{ id: 'change', reason: 'Donation', change: 5 }] }], actor), []);
});
test('live reports deduplicate request/pickup records and filter the month', () => {
  const requests = [{ id: 'a', studentId: 'P1', status: 'Approved', date: '2026-10-15' }, { id: 'b', status: 'Declined', date: '2026-10-16' }];
  const pickups = [{ ...requests[0], status: 'Completed', items: [{ name: 'Rice', qty: 3 }] }, { id: 'old', status: 'Completed', date: '2026-07-01', items: [{ name: 'Rice', qty: 99 }] }];
  const report = buildReport('2026-10', requests, pickups, [{ received: '2026-10-01' }], [], record => record.date);
  assert.equal(report.students, 1);
  assert.equal(report.completed, 1);
  assert.equal(report.units, 3);
  assert.equal(report.donations, 1);
  assert.deepEqual(report.results.find(([name]) => name === 'Declined'), ['Declined', 1]);
  assert.deepEqual(report.items, [['Rice', 3]]);
});
test('CSV exports selected-month aggregates only and escapes unsafe cells', () => {
  const csv = reportCsv('2026-09', reportSnapshots['2026-09']);
  assert.match(csv, /"2026-09","Summary","Units handed out","3410"/);
  for (const user of initialAdminUsers) { assert.ok(!csv.includes(user.name)); assert.ok(!csv.includes(user.email)); }
  const escaped = reportCsv('2026-09', { ...reportSnapshots['2026-09'], items: [['=formula,"quoted"', 1]] });
  assert.ok(escaped.includes("'="));
  assert.ok(escaped.includes('""quoted""'));
});
test('managed status and role govern mock sign-in, including sample aliases', async () => {
  assert.equal((await signInMock('admin', 'admin@pvamu.edu', mockPassword)).name, 'Taylor Brooks');
  const users = initialAdminUsers.map(user => user.id === 'user-dana' ? { ...user, active: false } : user);
  localStorage.setItem(adminUsersKey, JSON.stringify(users));
  await assert.rejects(signInMock('staff', 'staff@pvamu.edu', mockPassword), /inactive/);
  localStorage.setItem(adminUsersKey, JSON.stringify(users.map(user => user.id === 'user-dana' ? { ...user, active: true, role: 'admin' } : user)));
  await assert.rejects(signInMock('staff', 'staff@pvamu.edu', mockPassword), /portal/);
  assert.equal((await signInMock('admin', 'staff@pvamu.edu', mockPassword)).role, 'admin');
});
test('new staff accounts can sign in with the demo password', async () => {
  localStorage.setItem(adminUsersKey, JSON.stringify([...initialAdminUsers, { id: 'new', name: 'Avery Demo', email: 'avery@pvamu.edu', role: 'staff', active: true }]));
  assert.equal((await signInMock('staff', 'avery@pvamu.edu', mockPassword)).name, 'Avery Demo');
  await assert.rejects(signInMock('staff', 'avery@pvamu.edu', 'wrong'), /incorrect/);
});
test('provisional students can register without duplicating their directory entry', async () => {
  localStorage.setItem(adminUsersKey, JSON.stringify([...initialAdminUsers, { id: 'provisional', studentId: 'P12345678', name: 'Student Demo', email: '', role: 'student', active: true, provisional: true }]));
  await registerMock({ name: 'Student Demo', studentId: 'P12345678', email: 'student.demo@pvamu.edu', password: 'DemoPass2026!' });
  const users = JSON.parse(localStorage.getItem(adminUsersKey));
  assert.equal(users.filter(user => user.studentId === 'P12345678').length, 1);
  assert.equal(users.find(user => user.id === 'provisional').provisional, false);
  assert.equal((await signInMock('student', 'student.demo@pvamu.edu', 'DemoPass2026!')).studentId, 'P12345678');
  await assert.rejects(signInMock('student', 'student.demo@pvamu.edu', mockPassword), /incorrect/);
});
