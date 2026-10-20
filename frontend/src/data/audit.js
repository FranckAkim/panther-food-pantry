// Derive mock audit events from successful persisted changes, not from button clicks.
export function auditChanges(key, previous, next, actor) {
  if (!['staff', 'admin'].includes(actor?.role) || !Array.isArray(previous) || !Array.isArray(next)) return [];
  const events = [];
  const add = (action, record, change) => events.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), actor: actor.name, action, record, change });
  const before = new Map(previous.map(record => [record.id, record]));
  for (const record of next) {
    const old = before.get(record.id);
    if (key === 'panther-admin-users-v1') {
      // Unchanged directory entries may be materialized alongside a changed user.
      if (!old && record.createdAt) add('Account created', `User · ${record.name}`, `${record.role} · Active`);
      if (!old && !record.createdAt && record.role !== 'student') add('Role changed', `User · ${record.name}`, `student → ${record.role}`);
      if (!old && !record.createdAt && record.active === false) add('Account deactivated', `User · ${record.name}`, 'Active → Inactive');
      if (old && old.active !== record.active) add(record.active ? 'Account activated' : 'Account deactivated', `User · ${record.name}`, record.active ? 'Inactive → Active' : 'Active → Inactive');
      if (old && old.role !== record.role) add('Role changed', `User · ${record.name}`, `${old.role} → ${record.role}`);
    } else if (key === 'panther-staff-requests' && old && old.status !== record.status) {
      add(`Request ${record.status.toLowerCase()}`, `Request ${record.id} · ${record.name}`, `${old.status} → ${record.status}`);
    } else if (key === 'panther-staff-pickups' && ['Completed', 'No-show'].includes(record.status) && old?.status !== record.status) {
      add(record.status === 'Completed' ? 'Pickup completed' : 'Pickup marked no-show', `Request ${record.id} · ${record.name}`, `${old?.status || 'Approved'} → ${record.status}`);
    } else if (key === 'panther-donations-v1' && !old) {
      add('Donation recorded', `Donation · ${record.donor}`, `${record.lines} lots added · ${record.units} units`);
    } else if (key === 'panther-students-v1') {
      if (!old) add(record.provisional ? 'Provisional profile created' : 'Student profile created', `Student · ${record.name}`, record.checked ? 'ID card checked' : 'Profile created');
      else if (old.checked !== record.checked) add('Student ID checked', `Student · ${record.name}`, 'ID card checked');
    } else if (key === 'panther-inventory-v1') {
      if (!old) add('Inventory item added', `Inventory · ${record.name}`, `${record.lots.reduce((sum, lot) => sum + Number(lot.quantity), 0)} ${record.unit}`);
      else {
        if (['name', 'category', 'unit', 'alert'].some(field => old[field] !== record[field])) add('Inventory item updated', `Inventory · ${record.name}`, ['name', 'category', 'unit', 'alert'].filter(field => old[field] !== record[field]).map(field => `${field}: ${old[field]} → ${record[field]}`).join('; '));
        for (const change of record.changes || []) if (change.reason?.startsWith('Adjustment') && !old.changes?.some(entry => entry.id === change.id)) add('Stock adjusted', `Inventory · ${record.name}`, `${change.change > 0 ? '+' : ''}${change.change} ${record.unit} · ${change.reason}`);
      }
    } else if (key === 'panther-pickup-slots-v1') {
      if (!old) add('Pickup slot created', `Slot · ${record.date} ${record.time}`, `Capacity: ${record.capacity}`);
      else if (old.capacity !== record.capacity) add('Pickup slot updated', `Slot · ${record.date} ${record.time}`, `Capacity: ${old.capacity} → ${record.capacity}`);
    }
  }
  if (key === 'panther-pickup-slots-v1') for (const old of previous) if (!next.some(record => record.id === old.id)) add('Pickup slot removed', `Slot · ${old.date} ${old.time}`, 'Slot removed');
  return events;
}
