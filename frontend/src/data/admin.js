// Mock administration data. Replace these stores with API calls when the backend is connected.
export const adminUsersKey = 'panther-admin-users-v1';
export const auditKey = 'panther-audit-log-v1';
export const initialAdminUsers = [
  { id: 'user-taylor', name: 'Taylor Brooks', email: 'tbrooks@pvamu.edu', aliases: ['admin@pvamu.edu'], role: 'admin', active: true, lastSignIn: '2026-10-14T08:00:00-05:00' },
  { id: 'user-dana', name: 'Dana Carter', email: 'dcarter@pvamu.edu', aliases: ['staff@pvamu.edu'], role: 'staff', active: true, lastSignIn: '2026-10-14T08:30:00-05:00' },
  { id: 'user-luis', name: 'Luis Ramirez', email: 'lramirez@pvamu.edu', role: 'staff', active: true, lastSignIn: '2026-10-12T09:00:00-05:00' },
  { id: 'user-sam', name: 'Sam Okafor', email: 'sokafor@pvamu.edu', role: 'staff', active: false, lastSignIn: '2026-08-30T09:00:00-05:00' },
  { id: 'user-jordan', name: 'Jordan Ellis', email: 'jellis@pvamu.edu', aliases: ['jordan@pvamu.edu'], studentId: 'P00281734', role: 'student', active: true, lastSignIn: '2026-10-13T09:00:00-05:00' },
  { id: 'user-maya', name: 'Maya Thompson', email: 'mthompson@pvamu.edu', studentId: 'P00213345', role: 'student', active: true, lastSignIn: '2026-10-14T09:00:00-05:00' },
];
export const roleLabel = role => ({ student: 'Student', staff: 'Staff', admin: 'Admin' }[role] || role);
export const matchesEmail = (user, email = '') => [user.email, ...(user.aliases || [])].some(value => value && value.toLowerCase() === email.toLowerCase());
export function mergeAdminUsers(users, students = [], accounts = []) {
  const merged = users.map(user => ({ ...user }));
  for (const account of accounts) {
    const existing = merged.find(user => matchesEmail(user, account.email) || (account.studentId && user.studentId === account.studentId));
    if (existing) {
      if (!existing.email) existing.email = account.email;
      else if (!matchesEmail(existing, account.email)) existing.aliases = [...(existing.aliases || []), account.email];
      existing.provisional = false;
    } else merged.push({ id: account.studentId || account.email, name: account.name, email: account.email, studentId: account.studentId, role: account.role, active: true, lastSignIn: null });
  }
  for (const student of students) {
    if (!merged.some(user => user.studentId === student.id)) merged.push({ id: `student-${student.id}`, studentId: student.id, name: student.name, email: student.email || '', role: 'student', active: true, provisional: Boolean(student.provisional), lastSignIn: null });
  }
  return merged;
}
export function validateUserChange(users, target, patch, actorEmail) {
  if (!target) return 'This user no longer exists.';
  if (matchesEmail(target, actorEmail)) return 'You cannot change your own role or deactivate your own account.';
  if (patch.role && !['student', 'staff', 'admin'].includes(patch.role)) return 'Choose a valid role.';
  if (target.role === 'admin' && target.active && (patch.active === false || (patch.role && patch.role !== 'admin')) && users.filter(user => user.role === 'admin' && user.active).length <= 1) return 'Keep at least one active admin account.';
  if (patch.role && patch.role !== 'student') {
    const email = patch.email || target.email;
    if (!/^[^\s@]+@pvamu\.edu$/.test(email || '')) return 'Enter a campus email address for this account.';
    if (users.some(user => user.id !== target.id && matchesEmail(user, email))) return 'An account with this email already exists.';
  }
  if (patch.role === 'student') {
    const studentId = patch.studentId || target.studentId;
    if (!/^P\d{8}$/.test(studentId || '')) return 'Enter a student ID: P followed by eight numbers.';
    if (users.some(user => user.id !== target.id && user.studentId === studentId)) return 'That student ID belongs to another user.';
  }
  return '';
}

const auditExamples = [
  ['12:41', 'Dana Carter', 'Request approved', 'Request #1044 · Olivia Reed', 'Submitted → Approved'],
  ['12:20', 'Dana Carter', 'Request declined', 'Request #1043 · Ethan Cole', 'Submitted → Declined'],
  ['11:52', 'Luis Ramirez', 'Donation recorded', 'Donation #311 · Northside Community Church', '3 lots added'],
  ['11:12', 'Dana Carter', 'Pickup completed', 'Request #1038 · Kevin Nguyen', 'Approved → Completed'],
  ['10:21', 'Dana Carter', 'Pickup completed', 'Request #1031 · Andre Williams', 'Approved → Completed'],
  ['10:08', 'Dana Carter', 'Pickup completed', 'Request #1029 · Maya Thompson', 'Approved → Completed'],
  ['10:02', 'Luis Ramirez', 'Provisional profile created', 'Student · Darius King', 'ID card checked'],
  ['09:15', 'Taylor Brooks', 'Account deactivated', 'User · Sam Okafor', 'Active → Inactive'],
];
export const initialAuditLog = [
  ...auditExamples.map(([time, actor, action, record, change], i) => ({ id: `audit-seed-${i}`, timestamp: `2026-10-14T${time}:00-05:00`, actor, action, record, change })),
  ...Array.from({ length: 44 }, (_, i) => ({ id: `audit-history-${i}`, timestamp: new Date(Date.parse('2026-10-14T09:10:00-05:00') - i * 60000).toISOString(), actor: i % 2 ? 'Dana Carter' : 'Luis Ramirez', action: 'Stock adjusted', record: `Inventory · ${['Canned black beans', 'White rice (2 lb)', 'Spaghetti', 'Cereal'][i % 4]}`, change: `${24 + i} → ${23 + i} units · Stock count correction` })),
];
export const localDate = value => new Date(value).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
export const monthLabel = value => new Date(`${value}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
export const reportSnapshots = {
  '2026-09': { students: 142, completed: 268, units: 3410, donations: 31, expired: 46, results: [['Completed', 268], ['No-show', 23], ['Cancelled', 19], ['Declined', 12]], items: [['Canned black beans', 412], ['White rice (2 lb)', 298], ['Peanut butter', 245], ['Spaghetti', 230], ['Cereal', 214]] },
  '2026-08': { students: 118, completed: 224, units: 2796, donations: 26, expired: 32, results: [['Completed', 224], ['No-show', 18], ['Cancelled', 14], ['Declined', 10]], items: [['Canned black beans', 350], ['White rice (2 lb)', 264], ['Peanut butter', 221], ['Spaghetti', 190], ['Cereal', 176]] },
};
export function buildReport(month, requests, pickups, donations, inventory, requestDate) {
  if (reportSnapshots[month]) return reportSnapshots[month];
  const included = record => requestDate(record).startsWith(month);
  const records = new Map(requests.filter(included).map(record => [record.id, record]));
  pickups.filter(included).forEach(record => records.set(record.id, record));
  const completed = [...records.values()].filter(record => record.status === 'Completed');
  const totals = new Map();
  completed.forEach(record => (record.items || []).forEach(item => totals.set(item.name, (totals.get(item.name) || 0) + Number(item.qty || 0))));
  return {
    students: new Set(completed.map(record => record.studentId || record.id)).size,
    completed: completed.length,
    units: [...totals.values()].reduce((sum, units) => sum + units, 0),
    donations: donations.filter(record => record.received?.startsWith(month)).length,
    expired: inventory.flatMap(item => item.lots).filter(lot => lot.expiry?.startsWith(month) && lot.expiry < localDate(new Date())).reduce((sum, lot) => sum + Number(lot.quantity), 0),
    results: ['Completed', 'No-show', 'Cancelled', 'Declined'].map(status => [status, [...records.values()].filter(record => record.status === status).length]),
    items: [...totals].sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}
export function reportCsv(month, report) {
  const total = report.results.reduce((sum, [, count]) => sum + count, 0);
  const rows = [['Month', 'Section', 'Metric', 'Count', 'Share'], ...[['Students served', report.students], ['Pickups completed', report.completed], ['Units handed out', report.units], ['Donations received', report.donations], ['Units expired', report.expired]].map(([name, value]) => [month, 'Summary', name, value, '']), ...report.results.map(([name, count]) => [month, 'Requests by result', name, count, `${total ? Math.round(count / total * 100) : 0}%`]), ...report.items.map(([name, count]) => [month, 'Most handed out', name, count, ''])];
  return '\uFEFF' + rows.map(row => row.map(value => `"${String(value).replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`).join(',')).join('\r\n');
}
