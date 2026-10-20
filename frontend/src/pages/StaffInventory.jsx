import { DataLoader } from "../components/Loading.jsx";
import { notifyError } from '../components/Notifications.jsx';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { AsyncForm, Button, Badge, Field, Modal, PageHeading, Card, EmptyState } from '../components/ui.jsx';
import { usePersistedState } from '../hooks/usePersistedState.js';
import plusWhite from '../assets/stock-plus-white.svg';
import plusPurple from '../assets/stock-plus-purple.svg';
import searchIcon from '../assets/stock-search.svg';
import removeIcon from '../assets/stock-remove.svg';
import calendarIcon from '../assets/stock-calendar.svg';
import addStudentIcon from '../assets/stock-add-student.svg';
import checkIcon from '../assets/stock-check.svg';
import leftIcon from '../assets/stock-left.svg';
import rightIcon from '../assets/stock-right.svg';
import './staff-inventory.css';

const categories = ['Canned goods', 'Protein', 'Grains and pasta', 'Breakfast', 'Dairy', 'Produce', 'Personal care'];
const initialRows = [
  ['black-beans', 'Canned black beans', 'Canned goods', 48, 'cans', 20, '2026-11-02'],
  ['green-beans', 'Canned green beans', 'Canned goods', 36, 'cans', 20, '2027-01-15'],
  ['chicken-soup', 'Chicken noodle soup', 'Canned goods', 22, 'cans', 15, '2026-10-20'],
  ['tuna', 'Canned tuna', 'Protein', 11, 'cans', 20, '2027-04-03'],
  ['peanut-butter', 'Peanut butter', 'Protein', 6, 'jars', 15, '2026-12-05'],
  ['rice', 'White rice (2 lb)', 'Grains and pasta', 30, 'bags', 10, '2027-03-01'],
  ['spaghetti', 'Spaghetti', 'Grains and pasta', 27, 'boxes', 10, '2027-02-10'],
  ['cereal', 'Cereal', 'Breakfast', 9, 'boxes', 12, '2026-11-30'],
  ['oatmeal', 'Oatmeal', 'Breakfast', 14, 'canisters', 8, '2027-01-22'],
  ['milk', 'Shelf-stable milk', 'Dairy', 8, 'cartons', 20, '2026-10-18'],
  ['apples', 'Apples', 'Produce', 12, 'lb', 10, '2026-10-17'],
];
const additionalRows = [
  ['Canned corn', 'Canned goods', 'cans'], ['Diced tomatoes', 'Canned goods', 'cans'], ['Tomato sauce', 'Canned goods', 'cans'],
  ['Kidney beans', 'Canned goods', 'cans'], ['Chickpeas', 'Canned goods', 'cans'], ['Lentil soup', 'Canned goods', 'cans'],
  ['Canned peaches', 'Canned goods', 'cans'], ['Canned pears', 'Canned goods', 'cans'], ['Canned chicken', 'Protein', 'cans'],
  ['Dried lentils', 'Protein', 'bags'], ['Mixed nuts', 'Protein', 'bags'], ['Sunflower butter', 'Protein', 'jars'],
  ['Brown rice', 'Grains and pasta', 'bags'], ['Macaroni', 'Grains and pasta', 'boxes'], ['Penne pasta', 'Grains and pasta', 'boxes'],
  ['Whole-wheat pasta', 'Grains and pasta', 'boxes'], ['Couscous', 'Grains and pasta', 'boxes'], ['Flour', 'Grains and pasta', 'bags'],
  ['Granola bars', 'Breakfast', 'boxes'], ['Pancake mix', 'Breakfast', 'boxes'], ['Instant oatmeal', 'Breakfast', 'boxes'],
  ['Raisins', 'Produce', 'bags'], ['Applesauce', 'Produce', 'jars'], ['Powdered milk', 'Dairy', 'boxes'],
  ['Toothpaste', 'Personal care', 'tubes'], ['Soap', 'Personal care', 'bars'], ['Shampoo', 'Personal care', 'bottles'],
];
export const initialItems = [...initialRows, ...additionalRows.map(([name, category, unit], i) => [`other-${i}`, name, category, 25 + i, unit, 10, '2027-05-01'])].map(([id, name, category, quantity, unit, alert, expiry]) => ({
  id, name, category, unit, alert, lots: id === 'black-beans' ? [
    { id: 'beans-1', expiry: '2026-11-02', received: '2026-09-12', shelf: 'A2', quantity: 13, source: 'Donation · Alumni food drive' },
    { id: 'beans-2', expiry: '2027-02-14', received: '2026-09-28', shelf: 'A2', quantity: 23, source: 'Donation · Northside Community Church' },
    { id: 'beans-3', expiry: '2027-06-30', received: '2026-10-06', shelf: 'A3', quantity: 12, source: 'Purchased' },
  ] : id === 'chicken-soup' ? [
    { id: 'chicken-soup-1', expiry: '2026-10-20', received: '2026-10-06', shelf: 'A3', quantity: 10, source: 'Donation' },
    { id: 'chicken-soup-2', expiry: '2027-01-20', received: '2026-10-09', shelf: 'A3', quantity: 12, source: 'Donation' },
  ] : [{ id: `${id}-1`, expiry, received: '2026-10-06', shelf: ({ rice: 'B1', spaghetti: 'B2', milk: 'C1', apples: 'Cooler' })[id] || (category === 'Grains and pasta' ? 'B2' : 'A2'), quantity, source: 'Donation' }],
  changes: id === 'black-beans' ? [
    { id: 'change-1', when: 'Oct 14, 10:12 AM', change: -2, reason: 'Distribution', lot: 'Expires Nov 2', by: 'Dana Carter' },
    { id: 'change-2', when: 'Oct 13, 1:40 PM', change: -4, reason: 'Distribution', lot: 'Expires Nov 2', by: 'Dana Carter' },
    { id: 'change-3', when: 'Oct 9, 3:15 PM', change: -1, reason: 'Adjustment · dented can', lot: 'Expires Feb 14', by: 'Luis Ramirez' },
    { id: 'change-4', when: 'Sep 28, 11:02 AM', change: 24, reason: 'Donation', lot: 'Expires Feb 14', by: 'Luis Ramirez' },
  ] : [],
}));
export const initialStudents = [
  ['Aaliyah Brown', 'P00230417', false, 'Sep 3', 'Sep 29', 'Approved'],
  ['Chris Martinez', 'P00265503', false, '', '—', 'Submitted'],
  ['Darius King', 'P00987654', true, 'Oct 14', 'Oct 14', ''],
  ['Jordan Ellis', 'P00281734', false, 'Aug 27', 'Oct 1', 'Submitted'],
  ['Marcus Johnson', 'P00241190', false, '', '—', 'Approved'],
  ['Maya Thompson', 'P00213345', false, 'Sep 2', 'Oct 14', ''],
  ['Noah Patel', 'P00276620', false, 'Sep 10', 'Oct 5', 'Submitted'],
].map(([name, id, provisional, checked, lastPickup, request]) => ({ name, id, provisional, checked, lastPickup, request }));
export const initialDonations = [
  { id: 'donation-1', donor: 'Alumni food drive', received: '2026-10-09', lines: 4 },
  { id: 'donation-2', donor: 'Individual donor', received: '2026-10-06', lines: 1 },
  { id: 'donation-3', donor: 'Northside Community Church', received: '2026-09-28', lines: 5 },
  { id: 'donation-4', donor: 'Alumni food drive', received: '2026-09-12', lines: 6 },
];
const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const dateText = (value, year = true) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}) }) : '—';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
const actionTime = () => new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const quantityOf = item => item.lots.reduce((sum, lot) => sum + Number(lot.quantity), 0);
const nextExpiry = item => item.lots.filter(l => l.quantity > 0 && l.expiry).map(l => l.expiry).sort()[0];
const lowStock = item => quantityOf(item) < item.alert;
const expiresSoon = item => item.lots.some(l => l.quantity > 0 && l.expiry && l.expiry <= '2026-10-21');
const expiringLotCount = items => items.reduce((count, item) => count + item.lots.filter(l => l.quantity > 0 && l.expiry && l.expiry <= '2026-10-21').length, 0);

function Asset({ src }) { return <img className="stock-asset" src={src} alt="" />; }
function LinkButton({ children, onClick, underline = false }) { return <button type="button" className={`stock-link${underline ? ' stock-link-underlined' : ''}`} onClick={onClick}>{children}</button>; }
function DateInput(props) { return <span className="stock-date"><input className="input" type="date" {...props} /><img src={calendarIcon} alt="" /></span>; }
function Search({ value, onChange, placeholder }) { return <label className="stock-search"><Asset src={searchIcon} /><input className="input" type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} /></label>; }
function Status({ item }) { return <span className="stock-status">{lowStock(item) && <Badge tone="warning">Low stock</Badge>}{expiresSoon(item) && <span className="stock-badge stock-badge-orange">Expires soon</span>}{!lowStock(item) && !expiresSoon(item) && <Badge tone="success">In stock</Badge>}</span>; }
function Filter({ selected, onClick, children }) { return <button type="button" className={`stock-filter${selected ? ' is-selected' : ''}`} aria-pressed={selected} onClick={onClick}>{children}</button>; }
function StockTable({ children, className = '' }) { return <div className={`table-wrap stock-table-wrap ${className}`}><table className="data-table stock-table">{children}</table></div>; }

export default function StaffInventory({ page, navigate, notify = () => {} }) {
  const [items, setItems] = usePersistedState('panther-inventory-v1', initialItems);
  const [students, setStudents] = usePersistedState('panther-students-v1', initialStudents);
  const [donations, setDonations] = usePersistedState('panther-donations-v1', initialDonations);
  const [selectedItem, setSelectedItem] = usePersistedState('panther-selected-item', 'black-beans');
  const [selectedStudent, setSelectedStudent] = usePersistedState('panther-selected-student', 'P00987654');
  const showItem = itemId => { setSelectedItem(itemId); navigate('/staff/item-detail'); };
  const showStudent = studentId => { setSelectedStudent(studentId); navigate('/staff/student-profile'); };
  const common = { navigate, notify };
  return <div className="stock-pages">
    {page === 'inventory' && <InventoryPage {...common} items={items} setItems={setItems} showItem={showItem} />}
    {page === 'item-detail' && <ItemDetail {...common} item={items.find(i => i.id === selectedItem) || items[0]} setItems={setItems} />}
    {page === 'donations' && <Donations {...common} items={items} setItems={setItems} donations={donations} setDonations={setDonations} />}
    {page === 'students' && <Students {...common} students={students} setStudents={setStudents} showStudent={showStudent} />}
    {page === 'student-profile' && <StudentProfile {...common} student={students.find(s => s.id === selectedStudent) || students[0]} setStudents={setStudents} />}
    {(page === 'slots' || page === 'pickup-slots') && <PickupSlots {...common} />}
  </div>;
}

function InventoryPage({ items, setItems, showItem, notify }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [category, setCategory] = useState('');
  const [offset, setOffset] = useState(0);
  const [adding, setAdding] = useState(false);
  const filtered = items.filter(item => item.name.toLowerCase().includes(query.toLowerCase()) && (!category || category === item.category) && (filter === 'all' || (filter === 'low' ? lowStock(item) : expiresSoon(item))));
  useEffect(() => setOffset(0), [query, category, filter]);
  const visible = filtered.slice(offset, offset + 11);
  return <>
    <PageHeading title="Inventory" description={`${items.length} items · ${items.filter(lowStock).length} low stock · ${expiringLotCount(items)} lots expiring soon`} actions={<Button onClick={() => setAdding(true)}><Asset src={plusWhite} />Add item</Button>} />
    <div className="stock-toolbar"><Search value={query} onChange={setQuery} placeholder="Search items" /><div className="stock-filters" role="group" aria-label="Filter inventory"><Filter selected={filter === 'all'} onClick={() => setFilter('all')}>All</Filter><Filter selected={filter === 'low'} onClick={() => setFilter('low')}>Low stock · {items.filter(lowStock).length}</Filter><Filter selected={filter === 'expiry'} onClick={() => setFilter('expiry')}>Expires soon · {items.filter(expiresSoon).length}</Filter></div><select className="select stock-category" aria-label="Category" value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
    <DataLoader queryKey={JSON.stringify([query, filter, category, offset])} initialLoading={false} label="Loading inventory…"><StockTable className="stock-inventory-table"><thead><tr><th>Item</th><th>Category</th><th className="stock-number">On hand</th><th className="stock-number">Alert at</th><th>Next expiry</th><th>Status</th></tr></thead><tbody>{visible.map(item => <tr key={item.id}><td><LinkButton underline onClick={() => showItem(item.id)}>{item.name}</LinkButton></td><td className="muted">{item.category}</td><td className="stock-number">{quantityOf(item)} {item.unit}</td><td className="stock-number muted">{item.alert}</td><td>{dateText(nextExpiry(item))}</td><td><Status item={item} /></td></tr>)}</tbody></StockTable>
    {!filtered.length && <EmptyState title="No items found" description="Try another search or category." />}
    <div className="stock-pagination"><span className="muted">{offset ? `Showing ${offset + 1}–${offset + visible.length}` : `Showing ${visible.length}`} of {filtered.length} items</span><div className="stock-actions"><Button variant="secondary" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 11))}>Previous</Button><Button variant="secondary" disabled={offset + 11 >= filtered.length} onClick={() => setOffset(offset + 11)}>Next</Button></div></div>
    </DataLoader>
    {adding && <ItemEditor onClose={() => setAdding(false)} onSave={data => { const itemId = id(); const newItem = { ...data, id: itemId, changes: [], lots: [{ id: id(), quantity: data.quantity, expiry: data.expiry, shelf: data.shelf, received: today(), source: 'Initial stock' }] }; setItems(old => [...old, newItem]); setAdding(false); notify(`${data.name} added to inventory.`); }} />}
  </>;
}

function ItemEditor({ item, onClose, onSave }) {
  return <Modal title={item ? 'Edit item' : 'Add item'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loadingLabel="Saving…" type="submit" form="stock-item-form">{item ? 'Save changes' : 'Add item'}</Button></>}><AsyncForm id="stock-item-form" className="stack" onSubmit={(e, formData) => { e.preventDefault(); const f = formData; onSave({ name: f.get('name').trim(), category: f.get('category'), unit: f.get('unit').trim(), alert: Number(f.get('alert')), ...(!item ? { quantity: Number(f.get('quantity')), expiry: f.get('expiry'), shelf: f.get('shelf').trim() } : {}) }); }}>
    <Field label="Item name"><input className="input" name="name" required defaultValue={item?.name} /></Field><div className="form-grid"><Field label="Category"><select className="select" name="category" defaultValue={item?.category || categories[0]}>{categories.map(c => <option key={c}>{c}</option>)}</select></Field><Field label="Counted in"><input className="input" name="unit" placeholder="e.g. cans" required defaultValue={item?.unit || 'cans'} /></Field><Field label="Low-stock alert at"><input className="input" name="alert" type="number" min="0" required defaultValue={item?.alert ?? 10} /></Field>{!item && <><Field label="Opening quantity"><input className="input" name="quantity" type="number" min="0" required defaultValue="0" /></Field><Field label="Expires on"><DateInput name="expiry" /></Field><Field label="Shelf or bin"><input className="input" name="shelf" placeholder="A2" required /></Field></>}</div>
  </AsyncForm></Modal>;
}

function ItemDetail({ item, setItems, navigate, notify }) {
  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState(null);
  const lots = [...item.lots].sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999'));
  return <>
    <div className="stock-breadcrumb"><LinkButton underline onClick={() => navigate('/staff/inventory')}>Inventory</LinkButton><span>/ {item.name}</span></div>
    <PageHeading title={<span className="stock-title-status">{item.name}<Status item={item} /></span>} description={`${item.category} · counted in ${item.unit}`} actions={<><Button variant="secondary" onClick={() => setEditing(true)}>Edit item</Button><Button onClick={() => setAdjusting(lots[0]?.id || 'new')}>Adjust stock</Button></>} />
    <div className="stock-summary">{[['On hand', quantityOf(item), item.unit], ['Low-stock alert at', item.alert, item.unit], ['Lots', item.lots.length, ''], ['Next expiry', dateText(nextExpiry(item), false), '']].map(([label, value, unit]) => <Card key={label}><span className="muted">{label}</span><div className="stock-stat-value">{value} {unit && <span>{unit}</span>}</div></Card>)}</div>
    <Card className="stock-section"><div className="stock-section-header"><h2>Lots</h2><p>A lot is one delivery with its own expiry date and shelf. The lot that expires first goes out first.</p></div><StockTable className="stock-lots-table"><thead><tr><th>Expires</th><th>Received</th><th>Shelf</th><th className="stock-number">On hand</th><th>Source</th><th><span className="stock-sr-only">Actions</span></th></tr></thead><tbody>{lots.map((lot, index) => <tr key={lot.id}><td><span className="stock-lot-expiry">{dateText(lot.expiry)}{index === 0 && lot.quantity > 0 && <Badge tone="purple">Goes out next</Badge>}</span></td><td className="muted">{dateText(lot.received)}</td><td>{lot.shelf}</td><td className="stock-number">{lot.quantity}</td><td>{lot.source}</td><td><LinkButton onClick={() => setAdjusting(lot.id)}>Adjust</LinkButton></td></tr>)}</tbody></StockTable></Card>
    <Card className="stock-section"><div className="stock-section-header"><h2>Stock changes</h2></div>{item.changes.length ? <StockTable><thead><tr><th>When</th><th className="stock-number">Change</th><th>Reason</th><th>Lot</th><th>By</th></tr></thead><tbody>{item.changes.map(change => <tr key={change.id}><td className="muted">{change.when}</td><td className={`stock-number ${change.change > 0 ? 'stock-positive' : 'stock-negative'}`}>{change.change > 0 ? '+' : '−'}{Math.abs(change.change)}</td><td>{change.reason}</td><td>{change.lot}</td><td>{change.by}</td></tr>)}</tbody></StockTable> : <div className="stock-section-empty muted">No stock changes recorded yet.</div>}</Card>
    {editing && <ItemEditor item={item} onClose={() => setEditing(false)} onSave={data => { setItems(old => old.map(i => i.id === item.id ? { ...i, ...data } : i)); setEditing(false); notify('Item updated.'); }} />}
    {adjusting && <AdjustStock item={item} initialLot={adjusting} onClose={() => setAdjusting(null)} onSave={(lotId, quantity, reason) => { const lot = item.lots.find(l => l.id === lotId); const change = quantity - lot.quantity; setItems(old => old.map(i => i.id === item.id ? { ...i, lots: i.lots.map(l => l.id === lotId ? { ...l, quantity } : l), changes: [{ id: id(), when: actionTime(), change, reason: `Adjustment · ${reason}`, lot: `Expires ${dateText(lot.expiry, false)}`, by: 'Dana Carter' }, ...i.changes] } : i)); setAdjusting(null); notify('Stock adjustment recorded.'); }} />}
  </>;
}

function AdjustStock({ item, initialLot, onClose, onSave }) {
  const [lotId, setLotId] = useState(initialLot);
  const lot = item.lots.find(l => l.id === lotId) || item.lots[0];
  const [quantity, setQuantity] = useState(lot.quantity);
  return <Modal title="Adjust stock" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="stock-adjust-form" loadingLabel="Saving…" type="submit">Save adjustment</Button></>}><AsyncForm id="stock-adjust-form" className="stack" onSubmit={(e, formData) => { e.preventDefault(); onSave(lot.id, Number(quantity), formData.get('reason').trim()); }}><p className="muted">{item.name} · currently {quantityOf(item)} {item.unit} on hand</p><Field label="Lot"><select className="select" value={lot.id} onChange={e => { setLotId(e.target.value); setQuantity(item.lots.find(l => l.id === e.target.value).quantity); }}>{item.lots.map(l => <option key={l.id} value={l.id}>{dateText(l.expiry)} · {l.shelf} · {l.quantity} {item.unit}</option>)}</select></Field><Field label={`New quantity (${item.unit})`} hint={`This lot currently has ${lot.quantity} ${item.unit}.`}><input className="input" type="number" min="0" required value={quantity} onChange={e => setQuantity(e.target.value)} /></Field><Field label="Reason for adjustment"><input className="input" name="reason" placeholder="e.g. damaged package or stock count correction" required /></Field></AsyncForm></Modal>;
}

function Donations({ items, setItems, donations, setDonations, navigate, notify }) {
  const donorOptions = [...new Set(donations.flatMap(donation => donation.donors || [donation.donor]))];
  const [donorRows, setDonorRows] = useState(() => [{ id: id(), choice: '', name: '' }]);
  const [received, setReceived] = useState('');
  const [lines, setLines] = useState([]);
  const [viewing, setViewing] = useState(null);
  const donorNames = donorRows.map(row => (row.choice === 'other' ? row.name : row.choice.slice(6)).trim());
  const detailsReady = Boolean(received && donorNames.length && donorNames.every(Boolean));
  const units = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  const updateDonor = (rowId, patch) => setDonorRows(rows => rows.map(row => row.id === rowId ? { ...row, ...patch } : row));
  const updateLine = (lineId, patch) => setLines(old => old.map(line => line.id === lineId ? { ...line, ...patch } : line));
  const addItem = () => setLines(old => [...old, { id: id(), itemId: '', quantity: 1, expiry: '', shelf: '' }]);
  const save = e => {
    e.preventDefault();
    if (!donorNames.length || donorNames.some(name => !name)) { notifyError('Choose a donor or enter a name for each donor.'); return; }
    if (new Set(donorNames.map(name => name.toLowerCase())).size !== donorNames.length) { notifyError('Each donor should only be added once.'); return; }
    if (!received) { notifyError('Choose the date this donation was received.'); return; }
    if (!lines.length) { notifyError('Add at least one item to this donation.'); return; }
    for (const [index, line] of lines.entries()) {
      if (!items.some(item => item.id === line.itemId)) { notifyError(`Choose an inventory item for item ${index + 1}.`); return; }
      if (!Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1) { notifyError(`Enter a whole-number quantity of at least 1 for item ${index + 1}.`); return; }
      if (!line.expiry || !line.shelf.trim()) { notifyError(`Enter an expiry date and shelf or bin for item ${index + 1}.`); return; }
    }
    const donor = donorNames.join(', ');
    const entryId = id();
    const savedLines = lines.map(line => ({ ...line, quantity: Number(line.quantity), shelf: line.shelf.trim(), name: items.find(item => item.id === line.itemId).name }));
    setItems(old => old.map(item => {
      const matching = savedLines.filter(line => line.itemId === item.id);
      return matching.length ? { ...item, lots: [...item.lots, ...matching.map(line => ({ id: id(), quantity: line.quantity, expiry: line.expiry, shelf: line.shelf, received, source: `Donation · ${donor}` }))], changes: [...matching.map(line => ({ id: id(), when: actionTime(), change: line.quantity, reason: 'Donation', lot: `Expires ${dateText(line.expiry, false)}`, by: 'Dana Carter' })), ...item.changes] } : item;
    }));
    setDonations(old => [{ id: entryId, donor, donors: donorNames, received, lines: savedLines.length, units, details: savedLines }, ...old]);
    setDonorRows([{ id: id(), choice: '', name: '' }]);
    setReceived('');
    setLines([]);
    notify(`Donation saved. ${units} units added to inventory.`);
  };
  return <>
    <PageHeading title="Record donation" description="Start with who donated and when, then add the items you received." />
    <div className="stock-donation-layout">
      <AsyncForm className="stock-donation-form" onSubmit={save}>
        <section className="stock-donation-section" aria-labelledby="donation-details-title">
          <header className="stock-donation-step">
            <span className="stock-step-number" aria-hidden="true">1</span>
            <div><h2 id="donation-details-title">Donation details</h2><p>Select one or more donors and the date you received the donation.</p></div>
          </header>
          <div className="stock-donor-fields">
            {donorRows.map((row, index) => <Fragment key={row.id}>
              <div className={`stock-donor-row${index > 0 ? ' stock-additional-donor' : ''}`}>
                <Field label={index === 0 ? 'Donor' : `Donor ${index + 1}`}><select className="select" required value={row.choice} onChange={e => updateDonor(row.id, { choice: e.target.value })}><option value="">Choose a donor</option>{donorOptions.map(name => <option key={name} value={`donor:${name}`} disabled={donorNames.some((selected, otherIndex) => otherIndex !== index && selected.toLowerCase() === name.toLowerCase())}>{name}</option>)}<option value="other">Other</option></select></Field>
                {donorRows.length > 1 && <button className="stock-icon-button" type="button" aria-label={`Remove donor ${index + 1}`} onClick={() => setDonorRows(rows => rows.filter(donorRow => donorRow.id !== row.id))}><Asset src={removeIcon} /></button>}
              </div>
              {index === 0 && <Field label="Received on"><DateInput aria-label="Received on" required value={received} onChange={e => setReceived(e.target.value)} /></Field>}
              {row.choice === 'other' && <Field label={index === 0 ? 'Donor name' : `Donor ${index + 1} name`} className="stock-other-donor"><input className="input" name={`donorName-${row.id}`} placeholder="Enter the donor's name" required value={row.name} onChange={e => updateDonor(row.id, { name: e.target.value })} /></Field>}
            </Fragment>)}
            <Button className="stock-add-donor" variant="secondary" type="button" onClick={() => setDonorRows(rows => [...rows, { id: id(), choice: '', name: '' }])}><Asset src={plusPurple} />Add another donor</Button>
          </div>
        </section>
        {detailsReady ? <section className="stock-donation-section stock-received-section" aria-labelledby="donation-items-title">
          <header className="stock-donation-step">
            <span className="stock-step-number" aria-hidden="true">2</span>
            <div><h2 id="donation-items-title">Items received</h2><p>Add each item, its quantity, expiry date, and storage location.</p></div>
            <Button variant="secondary" onClick={addItem}><Asset src={plusPurple} />Add item</Button>
          </header>
          {lines.length ? <div className="stock-donation-items">
            {lines.map((line, index) => {
              const selectedItem = items.find(item => item.id === line.itemId);
              return <fieldset key={line.id} className="stock-donation-item">
                <legend className="stock-sr-only">Item {index + 1}</legend>
                <div className="stock-donation-item-heading"><h3>Item {index + 1}</h3><button className="stock-icon-button" type="button" aria-label={`Remove item ${index + 1}`} onClick={() => setLines(old => old.filter(item => item.id !== line.id))}><Asset src={removeIcon} /></button></div>
                <div className="stock-donation-item-fields">
                  <Field label="Item" className="stock-donation-item-choice"><select className="select" aria-label={`Item ${index + 1}`} required value={line.itemId} onChange={e => updateLine(line.id, { itemId: e.target.value })}><option value="">Choose an item</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
                  <Field label={selectedItem ? `Quantity (${selectedItem.unit})` : 'Quantity'}><input className="input" aria-label={`Quantity, item ${index + 1}`} type="number" min="1" step="1" required value={line.quantity} onChange={e => updateLine(line.id, { quantity: e.target.value })} /></Field>
                  <Field label="Expires on"><DateInput aria-label={`Expires on, item ${index + 1}`} required value={line.expiry} onChange={e => updateLine(line.id, { expiry: e.target.value })} /></Field>
                  <Field label="Shelf or bin"><input className="input" aria-label={`Shelf or bin, item ${index + 1}`} placeholder="e.g. A2 or Cooler" required value={line.shelf} onChange={e => updateLine(line.id, { shelf: e.target.value })} /></Field>
                </div>
              </fieldset>;
            })}
          </div> : <div className="stock-donation-empty"><h3>No items added yet</h3><p>Use “Add item” to record what was received.</p></div>}
        </section> : <div className="stock-donation-next" role="status"><span className="stock-step-number" aria-hidden="true">2</span><div><strong>Next: items received</strong><p>Complete the donor details and received date to add items.{lines.length > 0 && ' Your item entries are kept while you update these details.'}</p></div></div>}
        <footer className="stock-donation-footer">
          <div className="stock-donation-total"><strong>{lines.length} {lines.length === 1 ? 'item' : 'items'} · {units} units</strong><span>Items are added to inventory when you save.</span></div>
          <div className="stock-actions"><Button variant="secondary" onClick={() => navigate('/staff/inventory')}>Cancel</Button><Button loadingLabel="Saving…" type="submit" disabled={!detailsReady || !lines.length}>Save donation</Button></div>
        </footer>
      </AsyncForm>
      <Card className="stock-recent"><h2>Recent donations</h2>{donations.slice(0, 8).map(donation => <button key={donation.id} type="button" className="stock-recent-entry" onClick={() => setViewing(donation)}><span>{donation.donor}</span><span className="muted">{dateText(donation.received, false)} · {donation.lines} {donation.lines === 1 ? 'item' : 'items'}</span></button>)}</Card>
    </div>
    {viewing && <Modal title={viewing.donor} onClose={() => setViewing(null)} footer={<Button variant="secondary" onClick={() => setViewing(null)}>Close</Button>}><DataLoader queryKey={viewing.id} label="Loading donation…" compact><p className="muted">Received {dateText(viewing.received)} · {viewing.lines} {viewing.lines === 1 ? 'item' : 'items'}</p>{viewing.details ? <ul className="stock-donation-details">{viewing.details.map(line => <li key={line.id}><strong>{line.name}</strong><span>{line.quantity} units · Shelf {line.shelf}</span><span className="muted">Expires {dateText(line.expiry)}</span></li>)}</ul> : <p>Recorded donation. Individual item details are available in the corresponding inventory lots.</p>}</DataLoader></Modal>}
  </>;
}

function Students({ students, setStudents, showStudent, notify }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(null);
  const filtered = students.filter(s => `${s.name} ${s.id}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || (filter === 'unchecked' ? !s.checked : s.provisional)));
  return <>
    <PageHeading title="Students" description="Check ID cards and help students sign up." actions={<Button onClick={() => setCreating(true)}><Asset src={addStudentIcon} />Help a student sign up</Button>} />
    <div className="stock-toolbar"><Search value={query} onChange={setQuery} placeholder="Search name or student ID" /><div className="stock-filters" role="group" aria-label="Filter students"><Filter selected={filter === 'all'} onClick={() => setFilter('all')}>All</Filter><Filter selected={filter === 'unchecked'} onClick={() => setFilter('unchecked')}>ID not checked · {students.filter(s => !s.checked).length}</Filter><Filter selected={filter === 'provisional'} onClick={() => setFilter('provisional')}>Provisional · {students.filter(s => s.provisional).length}</Filter></div></div>
    <DataLoader queryKey={JSON.stringify([query, filter])} initialLoading={false} label="Loading students…"><StockTable className="stock-student-table"><thead><tr><th>Name</th><th>Student ID</th><th>Account</th><th>ID card</th><th>Last pickup</th><th>Open request</th><th><span className="stock-sr-only">Actions</span></th></tr></thead><tbody>{filtered.map(student => <tr key={student.id}><td className="stock-medium">{student.name}</td><td className="muted">{student.id}</td><td>{student.provisional ? <Badge tone="neutral">Provisional</Badge> : 'Has account'}</td><td>{student.checked ? <span className="stock-checked"><Asset src={checkIcon} />Checked {student.checked}</span> : <Badge tone="warning">Not checked</Badge>}</td><td className="muted">{student.lastPickup}</td><td>{student.request ? <Badge tone={student.request === 'Approved' ? 'info' : 'warning'}>{student.request}</Badge> : <span className="muted">—</span>}</td><td className="stock-student-action">{student.checked ? <LinkButton onClick={() => showStudent(student.id)}>View</LinkButton> : <Button variant="secondary" onClick={() => setChecking(student)}>Check ID</Button>}</td></tr>)}</tbody></StockTable>
    {!filtered.length && <EmptyState title="No students found" description="Try another name, student ID, or filter." />}
    </DataLoader>
    {creating && <CreateStudent students={students} onClose={() => setCreating(false)} onSave={student => { setStudents(old => [...old, student]); setCreating(false); notify(`${student.name}'s provisional profile was created.`); }} />}
    {checking && <CheckStudent student={checking} onClose={() => setChecking(null)} onSave={() => { setStudents(old => old.map(s => s.id === checking.id ? { ...s, checked: dateText(today(), false) } : s)); setChecking(null); notify('Student ID check recorded.'); }} />}
  </>;
}

function CreateStudent({ students, onClose, onSave }) {
  return <Modal title="Help a student sign up" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loadingLabel="Saving…" type="submit" form="stock-create-student">Create profile</Button></>}><AsyncForm id="stock-create-student" className="stack" onSubmit={(e, formData) => { e.preventDefault(); const data = formData; const studentId = data.get('studentId').trim().toUpperCase(); if (students.some(s => s.id === studentId)) { notifyError('A profile with this student ID already exists. Search for their existing profile.'); return; } onSave({ name: data.get('name').trim(), id: studentId, provisional: true, checked: data.get('checked') ? dateText(today(), false) : '', lastPickup: '—', request: '' }); }}><p className="muted">Create a provisional profile so the student can receive food. When they sign up using the same student ID, their pickups can be linked to their account.</p><Field label="Full name"><input className="input" name="name" required /></Field><Field label="Student ID number"><input className="input" name="studentId" placeholder="P00987654" pattern="[Pp][0-9]{8}" title="Use P followed by eight digits." required /></Field><label className="stock-check-label"><input type="checkbox" name="checked" />I checked the student's ID card</label></AsyncForm></Modal>;
}

function CheckStudent({ student, onClose, onSave }) {
  return <Modal title="Check student ID" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button form="stock-check-id" loadingLabel="Saving…" type="submit">Save ID check</Button></>}><AsyncForm id="stock-check-id" className="stack" onSubmit={(e, formData) => { e.preventDefault(); onSave(); }}><p>Match the name and student ID on the student's card.</p><div className="stock-id-preview"><strong>{student.name}</strong><span>{student.id}</span></div><label className="stock-check-label"><input type="checkbox" required />I checked the student ID card</label></AsyncForm></Modal>;
}

function StudentProfile({ student, setStudents, navigate, notify }) {
  const [checking, setChecking] = useState(false);
  return <><div className="stock-breadcrumb"><LinkButton underline onClick={() => navigate('/staff/students')}>Students</LinkButton><span>/ {student.name}</span></div><PageHeading title={student.name} description={student.id} actions={!student.checked && <Button onClick={() => setChecking(true)}>Check ID</Button>} /><Card className="stock-profile"><h2>Student profile</h2><dl><div><dt>Account</dt><dd>{student.provisional ? <Badge tone="neutral">Provisional</Badge> : 'Has account'}</dd></div><div><dt>ID card</dt><dd>{student.checked ? <span className="stock-checked"><Asset src={checkIcon} />Checked {student.checked}</span> : <Badge tone="warning">Not checked</Badge>}</dd></div><div><dt>Last pickup</dt><dd>{student.lastPickup}</dd></div><div><dt>Open request</dt><dd>{student.request ? <Badge tone={student.request === 'Approved' ? 'info' : 'warning'}>{student.request}</Badge> : 'No open request'}</dd></div></dl>{student.provisional && <p className="notice">If the student signs up later with this student ID, their pickups can be linked to the new account.</p>}</Card><div className="stock-actions"><Button variant="secondary" onClick={() => navigate('/staff/students')}>Back to students</Button><Button onClick={() => navigate('/staff/walk-in')}>Record a walk-in</Button></div>{checking && <CheckStudent student={student} onClose={() => setChecking(false)} onSave={() => { setStudents(old => old.map(s => s.id === student.id ? { ...s, checked: dateText(today(), false) } : s)); setChecking(false); notify('Student ID check recorded.'); }} />}</>;
}

const slotDays = [
  ['2026-10-12', [['10:00', 5], ['10:30', 4], ['13:00', 3], ['13:30', 2]]],
  ['2026-10-13', [['10:00', 3], ['10:30', 5], ['11:00', 2], ['13:00', 4]]],
  ['2026-10-14', [['10:00', 2], ['10:30', 1], ['11:00', 1], ['13:00', 2], ['13:30', 1]]],
  ['2026-10-15', [['10:00', 3], ['10:30', 5], ['11:00', 2], ['13:00', 0], ['13:30', 4]]],
  ['2026-10-16', [['10:00', 0], ['10:30', 1], ['13:00', 1], ['13:30', 1]]],
];
export const initialSlots = slotDays.flatMap(([date, slots]) => slots.map(([time, booked]) => ({ id: `${date}-${time}`, date, time, booked, capacity: 5 })));
const addDays = (date, n) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const timeText = time => { const [hour, minute] = time.split(':'); return `${Number(hour) % 12 || 12}:${minute} ${Number(hour) >= 12 ? 'PM' : 'AM'}`; };
function PickupSlots({ notify }) {
  const [slots, setSlots] = usePersistedState('panther-pickup-slots-v1', initialSlots);
  const [week, setWeek] = useState('2026-10-12');
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(week, i)), [week]);
  const end = days[4];
  const range = new Date(`${week}T12:00:00`).getMonth() === new Date(`${end}T12:00:00`).getMonth() ? `${dateText(week, false)} – ${Number(end.slice(8))}, ${end.slice(0, 4)}` : `${dateText(week, false)} – ${dateText(end)}`;
  return <>
    <PageHeading title="Pickup slots" description="Students book these times. Tap a slot to change its capacity." actions={<><Button variant="secondary" aria-label="Previous week" className="stock-week-button" onClick={() => setWeek(addDays(week, -7))}><Asset src={leftIcon} /></Button><span className="stock-week-label">{range}</span><Button variant="secondary" aria-label="Next week" className="stock-week-button" onClick={() => setWeek(addDays(week, 7))}><Asset src={rightIcon} /></Button><Button onClick={() => setAdding(true)}><Asset src={plusWhite} />Add slots</Button></>} />
    <DataLoader queryKey={week} initialLoading={false} label="Loading pickup slots…"><div className="stock-slot-board">{days.map(date => { const daySlots = slots.filter(s => s.date === date).sort((a, b) => a.time.localeCompare(b.time)); const past = date < today(); const isToday = date === today(); return <section className={`stock-slot-day${past ? ' stock-past-day' : ''}`} key={date}><header className={isToday ? 'stock-slot-today' : ''}><strong>{new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</strong><span>{isToday ? 'Today' : past ? 'Past' : `${daySlots.length} slots`}</span></header>{daySlots.map(slot => <button key={slot.id} className="stock-slot" type="button" onClick={() => setEditing(slot)} aria-label={`${dateText(date, false)}, ${timeText(slot.time)}, ${slot.booked} of ${slot.capacity} booked. Edit capacity.`}><span className="stock-slot-top"><strong>{timeText(slot.time)}</strong>{slot.booked >= slot.capacity && <Badge tone="neutral">Full</Badge>}</span><span className="muted">{slot.booked} of {slot.capacity} booked</span>{!past && <span className="stock-progress"><span style={{ width: `${Math.min(100, slot.booked / slot.capacity * 100)}%` }} /></span>}</button>)}{!daySlots.length && <p className="stock-empty-day muted">No slots scheduled</p>}</section>; })}</div>
    </DataLoader>
    {editing && <Modal title="Edit pickup slot" onClose={() => setEditing(null)} footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button loadingLabel="Saving…" type="submit" form="stock-slot-form">Save capacity</Button></>}><AsyncForm id="stock-slot-form" className="stack" onSubmit={(e, formData) => { e.preventDefault(); const capacity = Number(formData.get('capacity')); setSlots(old => old.map(s => s.id === editing.id ? { ...s, capacity } : s)); setEditing(null); notify('Pickup slot capacity updated.'); }}><p>{dateText(editing.date)} · {timeText(editing.time)}</p><Field label="Capacity" hint={`${editing.booked} students are already booked. Capacity cannot be lower than current bookings.`}><input className="input" name="capacity" type="number" min={Math.max(1, editing.booked)} required defaultValue={editing.capacity} /></Field></AsyncForm></Modal>}
    {adding && <AddSlots week={week} slots={slots} onClose={() => setAdding(false)} onSave={newSlots => { setSlots(old => [...old, ...newSlots]); setAdding(false); notify(`${newSlots.length} pickup ${newSlots.length === 1 ? 'slot' : 'slots'} added.`); }} />}
  </>;
}

function AddSlots({ week, slots, onClose, onSave }) {
  return <Modal title="Add pickup slots" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loadingLabel="Saving…" type="submit" form="stock-add-slots">Add slots</Button></>}><AsyncForm id="stock-add-slots" className="stack" onSubmit={(e, formData) => { e.preventDefault(); const data = formData; const date = data.get('date'); const start = data.get('start'); const end = data.get('end'); if (end <= start) { notifyError('End time must be later than start time.'); return; } const [hour, minute] = start.split(':').map(Number); const [endHour, endMinute] = end.split(':').map(Number); const newSlots = []; for (let at = hour * 60 + minute; at < endHour * 60 + endMinute; at += Number(data.get('interval'))) { const time = `${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`; if (!slots.some(s => s.date === date && s.time === time)) newSlots.push({ id: id(), date, time, capacity: Number(data.get('capacity')), booked: 0 }); } if (!newSlots.length) { notifyError('Slots already exist at all of these times. Choose a different time range.'); return; } onSave(newSlots); }}><Field label="Date"><DateInput name="date" required defaultValue={week < today() ? today() : week} /></Field><div className="form-grid"><Field label="Start time"><input className="input" type="time" name="start" required defaultValue="10:00" /></Field><Field label="End time"><input className="input" type="time" name="end" required defaultValue="14:00" /></Field><Field label="Slot interval"><select className="select" name="interval"><option value="30">Every 30 minutes</option><option value="15">Every 15 minutes</option><option value="60">Every hour</option></select></Field><Field label="Capacity per slot"><input className="input" name="capacity" type="number" min="1" required defaultValue="5" /></Field></div></AsyncForm></Modal>;
}
