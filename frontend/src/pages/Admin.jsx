import { useMemo, useState } from 'react';
import { AsyncForm, Badge, Button, Card, EmptyState, Field, Modal, PageHeading } from '../components/ui.jsx';
import { DataLoader, usePendingAction } from '../components/Loading.jsx';
import AdminIcon from '../components/AdminIcon.jsx';
import { notifyError } from '../components/Notifications.jsx';
import { usePersistedState } from '../hooks/usePersistedState.js';
import { initialItems, initialStudents, initialDonations } from './StaffInventory.jsx';
import { initialRequests, initialPickups, pickupDate } from './StaffRequests.jsx';
import { adminUsersKey, auditKey, initialAdminUsers, initialAuditLog, mergeAdminUsers, matchesEmail, roleLabel, validateUserChange, monthLabel, localDate, reportSnapshots, buildReport, reportCsv } from '../data/admin.js';
import { mockPassword } from '../data/mockAccounts.js';
import addStaffIcon from '../assets/stock-add-student.svg';
import './admin.css';

const dateLabel = date => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
function Search({ value, onChange, placeholder }) {
  return <div className="admin-search"><img src="/assets/staff-search.svg" alt="" /><input className="input" type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} /></div>;
}
export default function Admin({ page, profile, notify }) {
  return <div className="admin-pages">{page === 'reports' ? <Reports notify={notify} /> : page === 'users' ? <Users profile={profile} notify={notify} /> : <AuditLog />}</div>;
}

function Reports({ notify }) {
  const [month, setMonth] = useState('2026-09');
  const [requests] = usePersistedState('panther-staff-requests', initialRequests);
  const [pickups] = usePersistedState('panther-staff-pickups', initialPickups);
  const [donations] = usePersistedState('panther-donations-v1', initialDonations);
  const [inventory] = usePersistedState('panther-inventory-v1', initialItems);
  const { pending } = usePendingAction();
  const months = [...new Set([...Object.keys(reportSnapshots), localDate(new Date()).slice(0, 7), ...requests.map(record => pickupDate(record).slice(0, 7)), ...pickups.map(record => pickupDate(record).slice(0, 7)), ...donations.map(record => record.received.slice(0, 7))])].sort().reverse();
  const report = useMemo(() => buildReport(month, requests, pickups, donations, inventory, pickupDate), [month, requests, pickups, donations, inventory]);
  const resultTotal = report.results.reduce((sum, [, count]) => sum + count, 0);
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([reportCsv(month, report)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url; link.download = `panther-pantry-report-${month}.csv`; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Exported the ${monthLabel(month)} report.`);
  };
  return <>
    <PageHeading title="Reports" description="Counts only. No student names appear in reports." actions={<><select className="select admin-month" aria-label="Report month" value={month} disabled={!!pending} onChange={event => setMonth(event.target.value)}>{months.map(value => <option key={value} value={value}>{monthLabel(value)}</option>)}</select><Button variant="secondary" asyncAction loadingLabel="Exporting…" onClick={exportCsv}><AdminIcon name="download" size={18} />Export CSV</Button></>} />
    <DataLoader queryKey={month} initialLoading={false} label="Loading report…">
      <div className="admin-metrics">{[['Students served', report.students], ['Pickups completed', report.completed], ['Units handed out', report.units], ['Donations received', report.donations], ['Units expired', report.expired]].map(([label, value]) => <Card key={label}><p>{label}</p><strong>{value.toLocaleString('en-US')}</strong></Card>)}</div>
      <div className="admin-report-tables">
        <Card><h2>Requests by result</h2><table className="admin-summary-table"><thead><tr><th>Result</th><th>Requests</th><th>Share</th></tr></thead><tbody>{report.results.map(([status, count]) => <tr key={status}><td><Badge tone={{ Completed: 'success', 'No-show': 'warning', Cancelled: 'neutral', Declined: 'danger' }[status]}>{status}</Badge></td><td>{count}</td><td className="muted">{resultTotal ? Math.round(count / resultTotal * 100) : 0}%</td></tr>)}</tbody></table></Card>
        <Card><h2>Most handed out</h2>{report.items.length ? <table className="admin-summary-table"><thead><tr><th>Item</th><th>Units</th></tr></thead><tbody>{report.items.map(([name, units]) => <tr key={name}><td>{name}</td><td>{units.toLocaleString('en-US')}</td></tr>)}</tbody></table> : <EmptyState title="No item totals yet" description="Item totals appear after pickups with recorded items are completed." />}</Card>
      </div>
      {!reportSnapshots[month] && <p className="admin-report-note">Item totals include pickups with recorded item details. Expired units count stock remaining past its expiry date.</p>}
    </DataLoader>
  </>;
}

function Users({ profile, notify }) {
  const [storedUsers, setUsers] = usePersistedState(adminUsersKey, initialAdminUsers);
  const [students] = usePersistedState('panther-students-v1', initialStudents);
  const [accounts] = usePersistedState('panther-mock-accounts', []);
  const users = useMemo(() => mergeAdminUsers(storedUsers, students, accounts), [storedUsers, students, accounts]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [adding, setAdding] = useState(false);
  const [change, setChange] = useState(null);
  const [studentId, setStudentId] = useState('');
  const [roleEmail, setRoleEmail] = useState('');
  const { pending } = usePendingAction();
  const filtered = users.filter(user => (filter === 'All' || user.role === { Students: 'student', Staff: 'staff', Admins: 'admin' }[filter]) && `${user.name} ${user.email} ${user.studentId || ''} ${(user.aliases || []).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));
  function saveChange(event) {
    event.preventDefault();
    const patch = change.patch.role === 'student' ? { ...change.patch, studentId: studentId.trim().toUpperCase() } : change.patch;
    if (change.patch.role && change.patch.role !== 'student' && !change.user.email) patch.email = roleEmail.trim().toLowerCase();
    let saved = false;
    setUsers(current => {
      const all = mergeAdminUsers(current, students, accounts);
      const target = all.find(user => user.id === change.user.id);
      const error = validateUserChange(all, target, patch, profile.email);
      if (error) { notifyError(error); return current; }
      saved = true;
      return all.map(user => user.id === target.id ? { ...user, ...patch } : user);
    });
    if (saved) { notify(`${change.user.name}'s account updated.`); setChange(null); }
  }
  const lastSignIn = user => !user.lastSignIn ? 'Never' : localDate(user.lastSignIn) === localDate(new Date()) ? 'Today' : new Date(user.lastSignIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' });
  return <>
    <PageHeading title="Users" description="Who can sign in, and what they can do." actions={<Button onClick={() => setAdding(true)}><img src={addStaffIcon} width="20" height="20" alt="" />Add staff member</Button>} />
    <div className="admin-toolbar"><Search value={query} onChange={setQuery} placeholder="Search name or email" /><div className="admin-filters" role="group" aria-label="Filter users by role">{['All', 'Students', 'Staff', 'Admins'].map(role => <button type="button" key={role} className={`admin-filter${filter === role ? ' is-selected' : ''}`} aria-pressed={filter === role} onClick={() => setFilter(role)}>{role}</button>)}</div></div>
    <DataLoader queryKey={JSON.stringify([query, filter])} initialLoading={false} label="Loading users…">
      <div className="table-wrap"><table className="data-table admin-users-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last sign-in</th><th><span className="admin-sr-only">Account actions</span></th></tr></thead><tbody>{filtered.map(user => {
        const self = matchesEmail(user, profile.email);
        return <tr key={user.id}><td><strong>{user.name}</strong>{self && <span className="muted"> (you)</span>}{user.provisional ? <small>Provisional profile</small> : !user.email && <small>No sign-in account</small>}</td><td className="muted">{user.email || '—'}</td><td>{self ? roleLabel(user.role) : <select className="select admin-role" aria-label={`Role for ${user.name}`} disabled={!!pending} value={user.role} onChange={event => { setStudentId(user.studentId || ''); setRoleEmail(user.email || ''); setChange({ user, patch: { role: event.target.value } }); }}><option value="student">Student</option><option value="staff">Staff</option><option value="admin">Admin</option></select>}</td><td><Badge tone={user.active ? 'success' : 'neutral'}>{user.active ? 'Active' : 'Inactive'}</Badge></td><td className="muted">{lastSignIn(user)}</td><td>{!self && <button type="button" disabled={!!pending} className={`admin-text-action${user.active ? ' admin-deactivate' : ''}`} onClick={() => setChange({ user, patch: { active: !user.active } })}>{user.active ? 'Deactivate' : 'Activate'}</button>}</td></tr>;
      })}</tbody></table>{!filtered.length && <EmptyState title="No users found" description="Try another name, email, or role." />}</div>
    </DataLoader>
    {adding && <AddStaff users={users} onClose={() => setAdding(false)} onSave={user => {
      let saved = false;
      setUsers(current => {
        const all = mergeAdminUsers(current, students, accounts);
        if (all.some(existing => matchesEmail(existing, user.email))) { notifyError('An account with this email already exists.'); return current; }
        saved = true;
        return [...all, user];
      });
      if (saved) { setAdding(false); notify(`${user.name}'s mock staff account is ready.`); }
    }} />}
    {change && <Modal title={change.patch.role ? 'Change user role' : `${change.patch.active ? 'Activate' : 'Deactivate'} account`} onClose={() => setChange(null)} footer={<><Button variant="secondary" onClick={() => setChange(null)}>Cancel</Button><Button type="submit" form="admin-user-change" loadingLabel="Saving…">{change.patch.role ? 'Save role' : change.patch.active ? 'Activate account' : 'Deactivate account'}</Button></>}>
      <AsyncForm id="admin-user-change" className="stack" onSubmit={saveChange}>
        <p>{change.patch.role ? <>Change <strong>{change.user.name}</strong> from {roleLabel(change.user.role)} to <strong>{roleLabel(change.patch.role)}</strong>?</> : change.patch.active ? <><strong>{change.user.name}</strong> will be able to sign in again.</> : <><strong>{change.user.name}</strong> will no longer be able to sign in. Their records will be kept.</>}</p>
        {change.patch.role === 'student' && <Field label="Student ID"><input className="input" required pattern="[Pp][0-9]{8}" placeholder="P followed by eight numbers" value={studentId} onChange={event => setStudentId(event.target.value)} /></Field>}
        {change.patch.role && change.patch.role !== 'student' && !change.user.email && <Field label="Campus email"><input className="input" type="email" required placeholder="name@pvamu.edu" value={roleEmail} onChange={event => setRoleEmail(event.target.value)} /></Field>}
        {change.patch.role === 'admin' && <p className="muted">Admins can manage accounts, view reports, and review the audit log.</p>}
      </AsyncForm>
    </Modal>}
  </>;
}
function AddStaff({ users, onClose, onSave }) {
  return <Modal title="Add staff member" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="admin-add-staff" type="submit" loadingLabel="Creating account…">Add staff member</Button></>}>
    <AsyncForm id="admin-add-staff" className="stack" onSubmit={(event, data) => {
      event.preventDefault();
      const name = String(data.get('name') || '').trim();
      const email = String(data.get('email') || '').trim().toLowerCase();
      if (!name) { notifyError('Enter the staff member’s full name.'); return; }
      if (!/^[^\s@]+@pvamu\.edu$/.test(email)) { notifyError('Use a campus email address ending in @pvamu.edu.'); return; }
      if (users.some(user => matchesEmail(user, email))) { notifyError('An account with this email already exists.'); return; }
      onSave({ id: crypto.randomUUID(), name, email, role: 'staff', active: true, lastSignIn: null, createdAt: new Date().toISOString() });
    }}>
      <Field label="Full name"><input className="input" name="name" required maxLength={100} autoComplete="off" /></Field>
      <Field label="Campus email"><input className="input" name="email" type="email" required placeholder="name@pvamu.edu" autoComplete="off" /></Field>
      <p className="muted">This mock account can sign in through the Staff portal using the demo password <strong>{mockPassword}</strong>.</p>
    </AsyncForm>
  </Modal>;
}
function AuditLog() {
  const [entries] = usePersistedState(auditKey, initialAuditLog);
  const sorted = useMemo(() => [...entries].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)), [entries]);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('');
  const [date, setDate] = useState(() => sorted.length ? localDate(sorted[0].timestamp) : '');
  const [page, setPage] = useState(0);
  const actions = [...new Set(entries.map(entry => entry.action))].sort();
  const dates = [...new Set(entries.map(entry => localDate(entry.timestamp)))].sort().reverse();
  const filtered = sorted.filter(entry => (!action || entry.action === action) && (!date || localDate(entry.timestamp) === date) && `${entry.actor} ${entry.record} ${entry.action}`.toLowerCase().includes(query.trim().toLowerCase()));
  const pageSize = 8;
  const pageIndex = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
  const shown = filtered.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const filter = setter => event => { setter(event.target.value); setPage(0); };
  return <>
    <PageHeading title="Audit log" description="Every staff action is saved: who did it, when, and what changed." />
    <div className="admin-toolbar"><Search value={query} onChange={value => { setQuery(value); setPage(0); }} placeholder="Search person or record" /><select className="select admin-audit-filter" aria-label="Action" value={action} onChange={filter(setAction)}><option value="">All actions</option>{actions.map(value => <option key={value}>{value}</option>)}</select><select className="select admin-audit-filter" aria-label="Audit date" value={date} onChange={filter(setDate)}><option value="">All dates</option>{dates.map(value => <option key={value} value={value}>{value === localDate(new Date()) ? 'Today' : dateLabel(value)}</option>)}</select></div>
    <DataLoader queryKey={JSON.stringify([query, action, date, pageIndex])} initialLoading={false} label="Loading audit log…">
      <div className="table-wrap"><table className="data-table admin-audit-table"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Change</th></tr></thead><tbody>{shown.map(entry => <tr key={entry.id}><td className="muted"><time dateTime={entry.timestamp}>{!date && <small>{dateLabel(localDate(entry.timestamp))}</small>}{new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })}</time></td><td>{entry.actor}</td><td><strong>{entry.action}</strong></td><td>{entry.record}</td><td className="muted">{entry.change}</td></tr>)}</tbody></table>{!shown.length && <EmptyState title="No actions found" description="Try a different person, record, action, or date." />}</div>
      <div className="admin-pagination"><p className="muted" role="status">{filtered.length ? `Showing ${pageIndex * pageSize + 1}–${pageIndex * pageSize + shown.length} of ${filtered.length} actions` : '0 actions'}{date ? ` · ${dateLabel(date)}` : ''}</p><div><Button variant="secondary" disabled={pageIndex === 0} onClick={() => setPage(pageIndex - 1)}>Previous</Button><Button variant="secondary" disabled={(pageIndex + 1) * pageSize >= filtered.length} onClick={() => setPage(pageIndex + 1)}>Next</Button></div></div>
    </DataLoader>
  </>;
}
