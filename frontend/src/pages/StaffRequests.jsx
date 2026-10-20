import { DataLoader, usePendingAction } from "../components/Loading.jsx";
import { notifyError } from '../components/Notifications.jsx';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeading } from '../components/ui.jsx';
import { usePersistedState } from '../hooks/usePersistedState.js';
import { initialItems, initialSlots } from './StaffInventory.jsx';
import './staff-requests.css';

export const initialPickups = [
  { id: 'maya', name: 'Maya Thompson', studentId: 'P00213345', time: '10:00 AM', slot: '10:00 – 10:30 AM', status: 'Completed', pickedUp: '10:08 AM' },
  { id: 'andre', name: 'Andre Williams', studentId: 'P00198832', time: '10:00 AM', slot: '10:00 – 10:30 AM', status: 'Completed', pickedUp: '10:21 AM' },
  { id: 'jasmine', name: 'Jasmine Lee', studentId: 'P00233871', time: '10:30 AM', slot: '10:30 – 11:00 AM', status: 'Approved', noShowAllowed: true },
  { id: 'kevin', name: 'Kevin Nguyen', studentId: 'P00219456', time: '11:00 AM', slot: '11:00 – 11:30 AM', status: 'Completed', pickedUp: '11:12 AM' },
  { id: 'brianna', name: 'Brianna Davis', studentId: 'P00227781', time: '1:00 PM', slot: '1:00 – 1:30 PM', status: 'Approved' },
  { id: 'marcus', name: 'Marcus Johnson', studentId: 'P00241190', time: '1:00 PM', slot: '1:00 – 1:30 PM', status: 'Approved', firstVisit: true, note: 'No pork' },
  { id: 'aaliyah', name: 'Aaliyah Brown', studentId: 'P00230417', time: '1:30 PM', slot: '1:30 – 2:00 PM', status: 'Approved' },
].map(pickup => ({ ...pickup, date: '2026-10-14', fullPickupDate: 'Wed, Oct 14' }));
const waitingRequests = [
  { id: 'noah', name: 'Noah Patel', studentId: 'P00276620', pickup: 'Thu, Oct 15 · 10:00 AM', sent: 'Today, 9:12 AM', note: '', status: 'Waiting' },
  { id: 'imani', name: 'Imani Scott', studentId: 'P00259018', pickup: 'Thu, Oct 15 · 11:00 AM', sent: 'Today, 8:47 AM', note: '', status: 'Waiting' },
  { id: 'jordan', name: 'Jordan Ellis', studentId: 'P00281734', pickup: 'Thu, Oct 15 · 11:00 AM', sent: 'Yesterday, 7:30 PM', note: 'Vegetarian', status: 'Waiting' },
  { id: 'tasha', name: 'Tasha Green', studentId: 'P00244107', pickup: 'Fri, Oct 16 · 1:00 PM', sent: 'Yesterday, 4:02 PM', note: '', status: 'Waiting' },
  { id: 'chris', name: 'Chris Martinez', studentId: 'P00265503', pickup: 'Fri, Oct 16 · 1:30 PM', sent: 'Yesterday, 2:15 PM', note: 'No pork', firstVisit: true, status: 'Waiting' },
  { id: 'devon', name: 'Devon Hall', studentId: 'P00290351', pickup: 'Mon, Oct 19 · 10:30 AM', sent: 'Oct 13, 6:05 PM', note: '', status: 'Waiting' },
];
const approvedNames = [
  ['Alex Rivera', 'P00231814'], ['Taylor Brooks', 'P00220918'], ['Morgan Clark', 'P00276138'],
  ['Cameron Reed', 'P00261453'], ['Riley Adams', 'P00280127'], ['Casey Wilson', 'P00265379'], ['Jamie Davis', 'P00258104'],
];
export const initialRequests = [...waitingRequests, ...initialPickups.map(p => ({ ...p, pickup: `Wed, Oct 14 · ${p.time}`, sent: 'Oct 12, 3:30 PM', status: 'Approved' })), ...approvedNames.map(([name, studentId], i) => ({ id: `approved-${i}`, name, studentId, pickup: 'Thu, Oct 15 · 1:00 PM', sent: 'Oct 13, 10:00 AM', status: 'Approved' }))];
const foodCatalog = [
  { id: 'black-beans', name: 'Canned black beans', unit: 'can', plural: 'cans', qty: 2, expires: 'Nov 2, 2026', shelf: 'Shelf A2', onHand: 48 },
  { id: 'rice', name: 'White rice (2 lb)', unit: 'bag', plural: 'bags', qty: 1, expires: 'Mar 1, 2027', shelf: 'Shelf B1', onHand: 30 },
  { id: 'spaghetti', name: 'Spaghetti', unit: 'box', plural: 'boxes', qty: 1, expires: 'Feb 10, 2027', shelf: 'Shelf B2', onHand: 27 },
  { id: 'milk', name: 'Shelf-stable milk', unit: 'carton', plural: 'cartons', qty: 2, expires: 'Oct 18, 2026', shelf: 'Shelf C1', onHand: 8, expiring: true },
  { id: 'apples', name: 'Apples', unit: 'lb', plural: 'lb', qty: 2, expires: 'Oct 17, 2026', shelf: 'Cooler', onHand: 12, expiring: true },
  { id: 'peanut-butter', name: 'Peanut butter', unit: 'jar', plural: 'jars', qty: 1, expires: 'Jan 12, 2027', shelf: 'Shelf A1', onHand: 6 },
  { id: 'cereal', name: 'Cereal', unit: 'box', plural: 'boxes', qty: 1, expires: 'Dec 4, 2026', shelf: 'Shelf B3', onHand: 9 },
  { id: 'tuna', name: 'Canned tuna', unit: 'can', plural: 'cans', qty: 1, expires: 'Apr 10, 2027', shelf: 'Shelf A4', onHand: 11 },
];
const defaultPickup = initialPickups.find(p => p.id === 'marcus');
const asset = name => `/assets/staff-${name}.svg`;
const Asset = ({ name }) => <img className="sr-asset" alt="" src={asset(name)} />;
const toneFor = status => ({ Approved: 'blue', Completed: 'green', Waiting: 'gold', Declined: 'red', 'No-show': 'orange' }[status] || 'neutral');
const Status = ({ status }) => <Badge tone={toneFor(status)}>{status}</Badge>;
function readActivePickup() {
  try { return JSON.parse(localStorage.getItem('panther-active-pickup')) || defaultPickup; } catch { return defaultPickup; }
}
const chicagoToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
export function pickupDate(pickup) {
  if (pickup.date && /^\d{4}-\d{2}-\d{2}$/.test(pickup.date)) return pickup.date;
  const text = pickup.fullPickupDate || pickup.pickup || '';
  const match = text.match(/([A-Za-z]{3})\s+(\d{1,2})/);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(match?.[1]);
  if (match && month >= 0) return `2026-${String(month + 1).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  return pickup.time === 'Walk-in' ? chicagoToday() : '2026-10-14';
}
function pickupSlot(request) {
  if (request.slot) return request.slot;
  const time = request.time || request.pickup?.split(' · ')[1] || '1:00 PM';
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
  if (!match) return time;
  const total = ((Number(match[1]) % 12) + (match[3] === 'PM' ? 12 : 0)) * 60 + Number(match[2]) + 30;
  const hour = Math.floor(total / 60) % 24;
  const end = `${hour % 12 || 12}:${String(total % 60).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
  return `${time.replace(/ (AM|PM)$/, '')} – ${end}`;
}
function readSaved(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}
export function distributeInventory(inventory, selectedItems, pickupId, timestamp) {
  const changesByItem = new Map();
  for (const selected of selectedItems) {
    if (!Number.isInteger(selected.qty) || selected.qty < 1) throw new Error('Every item needs a whole-number quantity of at least 1.');
    const item = inventory.find(candidate => candidate.id === selected.id);
    const total = item?.lots.reduce((sum, lot) => sum + Math.max(0, Number(lot.quantity)), 0) || 0;
    if (!item || total < selected.qty) throw new Error(`Only ${total} ${item?.unit || 'units'} of ${selected.name.toLowerCase()} are available. Update the pickup quantity.`);
    if (item.changes?.some(change => change.pickupId === pickupId)) throw new Error('This pickup has already been recorded in inventory.');
    let remaining = selected.qty;
    const reductions = new Map();
    const changes = [];
    [...item.lots].sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999')).forEach(lot => {
      const used = Math.min(remaining, Math.max(0, Number(lot.quantity)));
      if (!used) return;
      reductions.set(lot.id, used);
      remaining -= used;
      changes.push({ id: `${pickupId}-${lot.id}`, pickupId, when: timestamp, change: -used, reason: 'Distribution', lot: lot.expiry ? `Expires ${new Date(`${lot.expiry}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'No expiration date', by: 'Dana Carter' });
    });
    changesByItem.set(item.id, { ...item, lots: item.lots.map(lot => ({ ...lot, quantity: Number(lot.quantity) - (reductions.get(lot.id) || 0) })), changes: [...changes, ...(item.changes || [])] });
  }
  return inventory.map(item => changesByItem.get(item.id) || item);
}
function SearchInput({ value, onChange, placeholder, label, ...props }) {
  return <div className="sr-search"><Asset name="search" /><input className="input" type="search" aria-label={label || placeholder} value={value} onChange={onChange} placeholder={placeholder} {...props} /></div>;
}

export default function StaffRequests({ page, navigate, notify }) {
  const { pending } = usePendingAction();
  const [requests, setRequests] = usePersistedState('panther-staff-requests', initialRequests);
  const [pickups, setPickups] = usePersistedState('panther-staff-pickups', initialPickups);
  const [inventory, setInventory] = usePersistedState('panther-inventory-v1', initialItems);
  const [, setSlots] = usePersistedState('panther-pickup-slots-v1', initialSlots);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Waiting');
  const [declining, setDeclining] = useState(null);
  const [reason, setReason] = useState('');
  const [selectedRequest, setSelectedRequest] = usePersistedState('panther-selected-request', waitingRequests[0].id);
  const [selectedPickup, setSelectedPickup] = useState(readActivePickup);
  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [idChecked, setIdChecked] = useState(true);
  const [dayOffset, setDayOffset] = usePersistedState('panther-pickup-day', 0);
  const [noShowPickup, setNoShowPickup] = useState(null);
  const waitingCount = requests.filter(r => r.status === 'Waiting').length;
  const approvedCount = requests.filter(r => r.status === 'Approved').length;
  const selectedDate = new Date(Date.UTC(2026, 9, 14 + dayOffset, 12)).toISOString().slice(0, 10);
  const dayPickups = pickups.filter(pickup => pickupDate(pickup) === selectedDate);
  const dashboardPickups = pickups.filter(pickup => pickupDate(pickup) === '2026-10-14');
  const doneCount = dayPickups.filter(p => p.status === 'Completed').length;
  const pendingCount = dayPickups.filter(p => p.status === 'Approved').length;
  const availableCatalog = useMemo(() => inventory.map(item => {
    const firstLot = [...item.lots].filter(lot => Number(lot.quantity) > 0).sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999'))[0];
    const known = foodCatalog.find(candidate => candidate.id === item.id);
    return { id: item.id, name: item.name, unit: known?.unit || item.unit.replace(/s$/, ''), plural: item.unit, qty: known?.qty || 1, onHand: item.lots.reduce((sum, lot) => sum + Number(lot.quantity), 0), expires: firstLot?.expiry ? new Date(`${firstLot.expiry}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—', shelf: firstLot?.shelf === 'Cooler' ? 'Cooler' : `Shelf ${firstLot?.shelf || '—'}`, expiring: firstLot?.expiry && firstLot.expiry <= '2026-10-21' };
  }), [inventory]);
  const displayedItems = items.map(item => ({ ...item, ...availableCatalog.find(candidate => candidate.id === item.id), qty: item.qty }));
  const lowStockItems = inventory.filter(item => item.lots.reduce((sum, lot) => sum + Number(lot.quantity), 0) < item.alert);
  const expiringLots = inventory.flatMap(item => item.lots.filter(lot => Number(lot.quantity) > 0 && lot.expiry && lot.expiry <= '2026-10-21').map(lot => ({ ...lot, itemName: item.name, unit: item.unit })));
  const activeRequest = requests.find(r => r.id === selectedRequest) || requests[0];
  const filteredRequests = useMemo(() => requests.filter(r => (filter === 'All' || r.status === filter) && `${r.name} ${r.studentId}`.toLowerCase().includes(search.toLowerCase())), [requests, filter, search]);

  useEffect(() => {
    if (page === 'distribution') {
      const active = readActivePickup();
      setSelectedPickup(active);
      setIdChecked(!active.firstVisit || active.idChecked === true || active.id === 'marcus');
      setItems([]);
      setItemId('');
      setQuantity(1);

    }
  }, [page]);

  const approve = request => {
    setRequests(current => current.map(r => r.id === request.id ? { ...r, status: 'Approved' } : r));
    const pickup = { ...request, status: 'Approved', date: pickupDate(request), slot: pickupSlot(request), time: request.time || request.pickup?.split(' · ')[1] || request.slot?.split(' – ')[0] || '1:00 PM' };
    setPickups(current => current.some(p => p.id === request.id) ? current.map(p => p.id === request.id ? pickup : p) : [...current, pickup]);
    notify(`${request.name}'s request approved.`);
  };
  const openDecline = request => { setDeclining(request); setReason(''); };
  const decline = () => {
    if (!reason.trim()) { notifyError('Enter a reason so the student knows why the request was declined.'); return; }
    setRequests(current => current.map(r => r.id === declining.id ? { ...r, status: 'Declined', slotReserved: false, declineReason: reason.trim() } : r));
    if (declining.slotReserved && declining.slotId) setSlots(current => current.map(slot => slot.id === declining.slotId ? { ...slot, booked: Math.max(0, slot.booked - 1) } : slot));
    notify(`${declining.name}'s request declined.`);
    setDeclining(null);
  };
  const openDistribution = pickup => {
    localStorage.setItem('panther-active-pickup', JSON.stringify(pickup));
    setSelectedPickup(pickup);
    navigate('/staff/distribution');
  };
  const addItem = event => {
    event.preventDefault();
    const match = availableCatalog.find(item => item.id === itemId && item.onHand > 0);
    const count = Number(quantity);
    if (!match) { notifyError('Choose an available item from the dropdown.'); return; }
    if (!Number.isInteger(count) || count < 1) { notifyError('Enter a whole-number quantity of at least 1.'); return; }
    const existing = items.find(item => item.id === match.id);
    if (count + (existing?.qty || 0) > match.onHand) { notifyError(`Only ${match.onHand} ${match.plural} of ${match.name.toLowerCase()} are available.`); return; }
    setItems(current => [{ ...match, qty: (current.find(item => item.id === match.id)?.qty || 0) + count }, ...current.filter(item => item.id !== match.id)]);
    setItemId(''); setQuantity(1);
  };
  const completePickup = () => {
    const currentRequest = readSaved('panther-staff-requests', requests).find(request => request.id === selectedPickup.id);
    if (currentRequest && ['Cancelled', 'Declined'].includes(currentRequest.status)) { notifyError('This request is no longer active. Return to the pickup list.'); return; }
    if (selectedPickup.firstVisit && !idChecked) { notifyError('Check the student ID card before completing this first pickup.'); return; }
    if (!items.length) { notifyError('Add at least one item before completing the pickup.'); return; }
    if (readSaved('panther-staff-pickups', pickups).some(p => p.id === selectedPickup.id && p.status === 'Completed')) { notifyError('This pickup has already been completed.'); return; }
    let updatedInventory;
    try {
      updatedInventory = distributeInventory(readSaved('panther-inventory-v1', inventory), displayedItems, selectedPickup.id, new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }));
    } catch (error) { notifyError(error.message); return; }
    const completed = { ...selectedPickup, date: pickupDate(selectedPickup), status: 'Completed', pickedUp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }), items: displayedItems, idChecked };
    setInventory(updatedInventory);
    setPickups(current => current.some(p => p.id === completed.id) ? current.map(p => p.id === completed.id ? completed : p) : [...current, completed]);
    setRequests(current => current.some(r => r.id === completed.id) ? current.map(r => r.id === completed.id ? { ...r, status: 'Completed', items: displayedItems } : r) : [...current, { ...completed, pickup: completed.slot || completed.time, sent: 'Walk-in' }]);
    localStorage.setItem('panther-active-pickup', JSON.stringify(completed));
    setDayOffset(Math.round((new Date(`${completed.date}T12:00:00Z`) - new Date('2026-10-14T12:00:00Z')) / 86400000));
    notify(`Pickup completed for ${selectedPickup.name}. ${items.reduce((sum, item) => sum + item.qty, 0)} units handed out.`);
    navigate('/staff/pickups');
  };
  const textLink = (text, destination) => <button className="sr-text-link" onClick={() => navigate(destination)}>{text}</button>;
  const walkInButton = <Button variant="secondary" onClick={() => navigate('/staff/walk-in')}><Asset name="walk-in" />Walk-in</Button>;

  return <div className="staff-requests">
    {page === 'dashboard' && <>
      <PageHeading title="Dashboard" description="Wednesday, Oct 14, 2026" actions={<>{walkInButton}<Button onClick={() => navigate('/staff/donations/new')}><Asset name="plus" />Record donation</Button></>} />
      <section className="sr-stat-grid" aria-label="Today at a glance">
        <Card className="sr-stat"><span>Waiting for approval</span><strong>{waitingCount}</strong>{textLink('Review requests', '/staff/requests')}</Card>
        <Card className="sr-stat"><span>Pickups today</span><strong>{dashboardPickups.length}</strong><p>{dashboardPickups.filter(p => p.status === 'Completed').length} done · {dashboardPickups.filter(p => p.status === 'Approved').length} to go</p></Card>
        <Card className="sr-stat"><span>Low-stock items</span><strong>{lowStockItems.length}</strong>{textLink('View inventory', '/staff/inventory')}</Card>
        <Card className="sr-stat"><span>Lots expiring in 7 days</span><strong>{expiringLots.length}</strong>{textLink('See which lots', '/staff/inventory?filter=expiring')}</Card>
      </section>
      <div className="sr-dashboard-columns">
        <Card className="sr-dashboard-pickups"><div className="sr-card-heading"><h2>Today's pickups</h2>{textLink('Open list', '/staff/pickups')}</div><ul className="sr-pickup-summary">{dashboardPickups.map(pickup => <li key={pickup.id}><time>{pickup.time || 'Walk-in'}</time><button className="sr-person-link" onClick={() => pickup.status === 'Approved' ? openDistribution(pickup) : navigate('/staff/pickups')}>{pickup.name}</button><Status status={pickup.status} /></li>)}</ul></Card>
        <div className="sr-dashboard-side">
          <Card><h2>Low stock</h2><div className="sr-mini-table-wrap"><table className="sr-mini-table"><thead><tr><th>Item</th><th className="sr-number">On hand</th><th className="sr-number">Alert at</th></tr></thead><tbody>{lowStockItems.sort((a, b) => a.lots.reduce((sum, lot) => sum + Number(lot.quantity), 0) - b.lots.reduce((sum, lot) => sum + Number(lot.quantity), 0)).map(item => [item.name, `${item.lots.reduce((sum, lot) => sum + Number(lot.quantity), 0)} ${item.unit}`, item.alert]).map(row => <tr key={row[0]}><td>{row[0]}</td><td className="sr-number">{row[1]}</td><td className="sr-number muted">{row[2]}</td></tr>)}</tbody></table></div></Card>
          <Card><h2>Expiring soon</h2><div className="sr-mini-table-wrap"><table className="sr-mini-table"><thead><tr><th>Item</th><th className="sr-number">Qty</th><th>Expires</th><th>Shelf</th></tr></thead><tbody>{expiringLots.sort((a, b) => a.expiry.localeCompare(b.expiry)).map(lot => [lot.itemName, `${lot.quantity} ${lot.unit}`, new Date(`${lot.expiry}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), lot.shelf]).map(row => <tr key={row[0]}><td>{row[0]}</td><td className="sr-number">{row[1]}</td><td><Badge tone="orange">{row[2]}</Badge></td><td>{row[3]}</td></tr>)}</tbody></table></div></Card>
        </div>
      </div>
    </>}

    {page === 'requests' && <>
      <PageHeading title="Requests" description="Approve or decline new requests. Declining needs a reason." actions={<SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or student ID" />} />
      <div className="sr-filter-group" role="group" aria-label="Filter requests">{[['Waiting', `Waiting · ${waitingCount}`], ['Approved', `Approved · ${approvedCount}`], ['All', 'All']].map(([value, label]) => <button key={value} className={`sr-filter ${filter === value ? 'active' : ''}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      <DataLoader queryKey={JSON.stringify([search, filter])} initialLoading={false} label="Loading requests…"><Card className="sr-requests-card"><div className="table-wrap"><table className="data-table sr-requests-table"><thead><tr><th>Student</th><th>Pickup</th><th>Sent</th><th>Food / note</th><th>ID card</th><th className="sr-actions-heading">Actions</th></tr></thead><tbody>{filteredRequests.map(request => <tr key={request.id}>
        <td><button className="sr-person-link sr-person-strong" onClick={() => { setSelectedRequest(request.id); navigate('/staff/request-detail'); }}>{request.name}</button><div className="muted">{request.studentId}</div></td><td>{request.pickup}</td><td className="muted">{request.sent}</td><td>{request.foodName && <div><strong>{request.foodName}</strong></div>}{request.note || (!request.foodName && <span className="muted">—</span>)}</td><td>{request.firstVisit ? <Badge tone="gold">First visit</Badge> : <span className="sr-checked"><Asset name="checked" />Checked</span>}</td><td><div className="sr-table-actions">{request.status === 'Waiting' ? <><Button asyncAction loadingLabel="Approving…" onClick={() => approve(request)}>Approve</Button><Button variant="secondary" className="sr-decline-button" onClick={() => openDecline(request)}>Decline</Button></> : <Status status={request.status} />}</div></td>
      </tr>)}</tbody></table></div>{!filteredRequests.length && <EmptyState title="No requests found" description={search ? 'Try a different name or student ID.' : 'There are no requests in this view.'} />}</Card></DataLoader>
    </>}

    {page === 'request-detail' && activeRequest && <>
      <div className="sr-breadcrumb">{textLink('Requests', '/staff/requests')}<span>/ {activeRequest.name}</span></div>
      <PageHeading title="Request details" description={`${activeRequest.name} · ${activeRequest.studentId}`} actions={<Status status={activeRequest.status} />} />
      <Card className="sr-request-details"><h2>Pickup request</h2><dl><div><dt>Student</dt><dd>{activeRequest.name}</dd></div><div><dt>Student ID</dt><dd>{activeRequest.studentId}</dd></div><div><dt>Pickup</dt><dd>{activeRequest.pickup}</dd></div><div><dt>Sent</dt><dd>{activeRequest.sent}</dd></div>{activeRequest.foodName && <div><dt>Requested food</dt><dd>{activeRequest.foodName}</dd></div>}<div><dt>Note</dt><dd>{activeRequest.note || 'No dietary notes'}</dd></div><div><dt>ID card</dt><dd>{activeRequest.firstVisit ? 'First visit — check at pickup' : 'Checked'}</dd></div></dl>{activeRequest.declineReason && <div className="notice"><strong>Reason for declining</strong><p>{activeRequest.declineReason}</p></div>}{activeRequest.status === 'Waiting' && <div className="sr-detail-actions"><Button variant="secondary" className="sr-decline-button" onClick={() => openDecline(activeRequest)}>Decline</Button><Button asyncAction loadingLabel="Approving…" onClick={() => approve(activeRequest)}>Approve request</Button></div>}</Card>
    </>}

    {page === 'pickups' && <>
      <PageHeading title={dayOffset === 0 ? "Today's pickups" : 'Pickups'} description={`${new Date(Date.UTC(2026, 9, 14 + dayOffset, 12)).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}${dayPickups.length ? ` · ${doneCount} done · ${pendingCount} to go` : ''}`} actions={<><div className="sr-day-controls"><Button variant="secondary" aria-label="Previous day" onClick={() => setDayOffset(day => day - 1)}><Asset name="previous" /></Button><Button variant="secondary" aria-label="Next day" onClick={() => setDayOffset(day => day + 1)}><Asset name="next" /></Button></div>{walkInButton}</>} />
      <DataLoader queryKey={dayOffset} initialLoading={false} label="Loading pickups…">{dayPickups.length ? <div className="sr-pickup-slots">{[...new Set(dayPickups.map(p => p.slot || 'Walk-in'))].map(slot => {
        const rows = dayPickups.filter(p => (p.slot || 'Walk-in') === slot);
        const noShowAt = slot.startsWith('1:30') ? '2:30 PM' : slot.startsWith('1:00') ? '2:00 PM' : null;
        return <Card className="sr-slot" key={slot}><div className="sr-slot-heading"><div><strong>{slot}</strong><span> · {rows.length} of 5 booked</span></div>{rows.some(p => p.noShowAllowed && p.status === 'Approved') ? <span className="sr-overdue">Slot ended · no-show allowed</span> : noShowAt && <span>No-show allowed after {noShowAt}</span>}</div>{rows.map(pickup => <div className="sr-slot-person" key={pickup.id}><div className="sr-slot-person-name"><strong>{pickup.name}</strong><div className="muted">{pickup.studentId}{pickup.firstVisit && pickup.status !== 'Completed' && <span className="sr-first-visit"> · First visit: check ID card</span>}</div></div><Status status={pickup.status} /><div className="sr-pickup-actions">{pickup.status === 'Completed' ? <span className="muted">Picked up {pickup.pickedUp}</span> : pickup.status === 'No-show' ? <span className="muted">Did not attend</span> : <><Button onClick={() => openDistribution(pickup)}>Hand out food</Button><Button variant="secondary" className="sr-no-show" disabled={!pickup.noShowAllowed} onClick={() => setNoShowPickup(pickup)}>Mark no-show</Button></>}</div></div>)}</Card>;
      })}</div> : <Card><EmptyState title="No pickups for this day" description="Choose another day to see scheduled pickups." /><div className="sr-return-today"><Button variant="secondary" onClick={() => setDayOffset(0)}>Back to today's pickups</Button></div></Card>}</DataLoader>
    </>}

    {page === 'distribution' && <>
      <div className="sr-distribution-heading"><div className="sr-breadcrumb">{textLink("Today's pickups", '/staff/pickups')}<span>/ {selectedPickup.name}</span></div><PageHeading title="Hand out food" description={`${selectedPickup.name} · ${selectedPickup.studentId} · ${selectedPickup.slot || selectedPickup.time || 'Walk-in'}`} /></div>
      <Card className="sr-student-summary"><dl><div><dt>Name</dt><dd>{selectedPickup.name}</dd></div><div><dt>Student ID</dt><dd>{selectedPickup.studentId}</dd></div><div><dt>Request</dt><dd><Status status={selectedPickup.status || 'Approved'} /></dd></div><div><dt>Note</dt><dd>{selectedPickup.note || '—'}</dd></div></dl>{selectedPickup.firstVisit && <label className="sr-id-check"><span>First visit</span><input type="checkbox" disabled={!!pending} checked={idChecked} onChange={e => setIdChecked(e.target.checked)} />I checked the student ID card</label>}</Card>
      <Card className="sr-distribution-card"><div className="sr-distribution-top"><h2>Items</h2><p className="muted">Oldest food goes out first. The system picks the lots that expire soonest.</p><form className="sr-add-item" onSubmit={addItem}><Field label="Add an item"><select className="select" value={itemId} onChange={e => setItemId(e.target.value)} disabled={!!pending}><option value="">Choose an item</option>{availableCatalog.filter(item => item.onHand > 0).map(item => <option key={item.id} value={item.id}>{item.name} · {item.onHand} {item.plural} available</option>)}</select></Field><Field label="Qty"><input className="input" type="number" min="1" step="1" aria-label="Quantity" disabled={!!pending} value={quantity} onChange={e => setQuantity(e.target.value)} /></Field><Button variant="secondary" type="submit">Add</Button></form></div>

        <div className="table-wrap"><table className="data-table sr-distribution-table"><thead><tr><th>Item</th><th>Qty</th><th>Taken from</th><th className="sr-number">On hand</th><th><span className="sr-visually-hidden">Remove item</span></th></tr></thead><tbody>{displayedItems.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.qty} {item.qty === 1 ? item.unit : item.plural}</td><td><div className="sr-lot"><span className="muted">Expires {item.expires} · {item.shelf}</span>{item.expiring && <Badge tone="orange">Expires soon</Badge>}</div></td><td className="sr-number">{item.onHand}</td><td><button disabled={!!pending} className="sr-remove-item" onClick={() => { setItems(current => current.filter(i => i.id !== item.id)); }} aria-label={`Remove ${item.name}`}><Asset name="remove" /></button></td></tr>)}</tbody></table></div>{!items.length && <EmptyState title="No items added" description="Choose an item from the dropdown and add the quantity being handed out." />}
        <div className="sr-distribution-footer"><span>{items.length} items · {items.reduce((sum, item) => sum + item.qty, 0)} units</span><div><Button variant="secondary" onClick={() => navigate('/staff/pickups')}>Cancel</Button><Button asyncAction loadingLabel="Completing pickup…" onClick={completePickup}>Complete pickup</Button></div></div>
      </Card>
    </>}

    {declining && <Modal title="Decline this request?" onClose={() => { setDeclining(null); }} footer={<><Button variant="secondary" onClick={() => { setDeclining(null); }}>Go back</Button><Button variant="danger" asyncAction loadingLabel="Declining…" onClick={decline}>Decline request</Button></>}><div className="sr-decline-dialog"><p className="muted">{declining.name} · {declining.pickup}</p><Field label="Reason (required)" hint="The student will see this reason."><textarea className="textarea" rows="3" autoFocus required value={reason} onChange={e => { setReason(e.target.value); }} placeholder="e.g. That pickup time is full. Please choose another time." /></Field></div></Modal>}
    {noShowPickup && <Modal title="Mark this pickup as a no-show?" onClose={() => setNoShowPickup(null)} footer={<><Button variant="secondary" onClick={() => setNoShowPickup(null)}>Go back</Button><Button variant="danger" asyncAction loadingLabel="Saving…" onClick={() => { setPickups(current => current.map(p => p.id === noShowPickup.id ? { ...p, status: 'No-show' } : p)); setRequests(current => current.map(r => r.id === noShowPickup.id ? { ...r, status: 'No-show' } : r)); notify(`${noShowPickup.name} marked as a no-show.`); setNoShowPickup(null); }}>Mark no-show</Button></>}><p>{noShowPickup.name} has not picked up their food for the {noShowPickup.slot} slot.</p></Modal>}
  </div>;
}
