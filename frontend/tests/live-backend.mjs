// Requires explicitly authorized temporary fixture accounts; no real user inputs.
// Provision/cleanup is performed by the project owner, not a public API endpoint.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createPantryApi } from '../src/lib/pantryApi.js';
const fixturePath = process.env.PANTRY_TEST_FIXTURES;
if (!fixturePath) throw new Error('Set PANTRY_TEST_FIXTURES to the private temporary fixture file.');
const fixtures = JSON.parse(await readFile(fixturePath, 'utf8'));
const url = 'https://pvidoddlywstnowhcfyl.supabase.co';
const key = 'sb_publishable_8DHTKww7F0OSt-8klBBnBg_aEDbmG8Y';
const makeClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const adminClient = makeClient(), studentClient = makeClient(), staffClient = makeClient();
const admin = createPantryApi(adminClient), student = createPantryApi(studentClient), staff = createPantryApi(staffClient);
const row = value => Array.isArray(value) ? value[0] : value;
try {
  await admin.signIn({ ...fixtures.admin, workspace: 'admin' });
  await student.signIn({ ...fixtures.student, workspace: 'student' });
  console.log('PASS: real administrator and student password login');
  const invitation = await admin.provisionStaff({ email: fixtures.staffEmail, displayName: 'Temporary staff test' });
  assert.equal(invitation.role, 'staff');
  const inviteUrl = new URL(invitation.invitationUrl);
  const verified = await staffClient.auth.verifyOtp({ token_hash: inviteUrl.searchParams.get('token'), type: 'invite' });
  if (verified.error) throw verified.error;
  const passwordSet = await staffClient.auth.updateUser({ password: fixtures.staffPassword });
  if (passwordSet.error) throw passwordSet.error;
  await staff.signOut();
  await staff.signIn({ email: fixtures.staffEmail, password: fixtures.staffPassword, workspace: 'staff' });
  console.log('PASS: administrator provisions staff; invitation acceptance and staff password login');
  await assert.rejects(student.provisionStaff({ email: `forbidden-${fixtures.run}@pvamu.edu` }));
  console.log('PASS: student cannot provision staff');
  const item = await staff.createItem({ name: `TEST ${fixtures.run}`, category: 'Canned food', unit: 'can' });
  await staff.updateItem(item.id, { name: `TEST ${fixtures.run} updated` });
  const lot = row(await staff.createLot({ itemId: item.id, quantity: 5, storageLocation: 'TEST shelf', receivedDate: '2026-10-13', expiryDate: '2027-10-13' }));
  await staff.updateLot(lot.id, { storageLocation: 'TEST shelf B' });
  const changed = row(await staff.adjustStock({ lotId: lot.id, delta: -4, reason: 'Temporary test adjustment' }));
  assert.equal(changed.qty_on_hand, 1);
  assert.equal((await staff.stockHistory(lot.id)).reduce((sum, entry) => sum + entry.quantity_change, 0), 1);
  console.log('PASS: staff adds/edits item and lot; audited stock adjustment');
  const available = await student.availableInventory();
  assert.ok(available.some(value => value.item_id === item.id));
  assert.ok(available.every(value => !('storage_location' in value) && !('actor_id' in value)));
  await assert.rejects(student.createItem({ name: 'Forbidden', category: 'Produce' }));
  const direct = await staffClient.from('inventory_lots').update({ qty_on_hand: 500 }).eq('id', lot.id);
  assert.ok(direct.error);
  console.log('PASS: student availability is limited; unauthorized writes rejected');
  const concurrent = await Promise.allSettled([
    staff.adjustStock({ lotId: lot.id, delta: -1, reason: 'Concurrent A' }),
    staff.adjustStock({ lotId: lot.id, delta: -1, reason: 'Concurrent B' }),
  ]);
  assert.equal(concurrent.filter(value => value.status === 'fulfilled').length, 1);
  assert.equal(concurrent.filter(value => value.status === 'rejected').length, 1);
  assert.equal((await staff.listLots()).find(value => value.id === lot.id).qty_on_hand, 0);
  assert.equal((await staff.stockHistory(lot.id)).reduce((sum, entry) => sum + entry.quantity_change, 0), 0);
  console.log('PASS: two simultaneous decrements cannot make stock negative');
  const request = await student.submitRequest({ categories: ['Canned food'] });
  assert.equal(request.student_id, fixtures.student.id);
  const staffOwnRequests = await staff.myRequests();
  assert.ok(!staffOwnRequests.some(value => value.id === request.id));
  const staffAllRequests = await staffClient.from('food_requests').select('*');
  assert.ok(staffAllRequests.data.some(value => value.id === request.id));
  console.log('PASS: student request submission and staff authorized read');
  await admin.setUserAccess({ userId: fixtures.student.id, role: 'student', enabled: false });
  await assert.rejects(student.availableInventory());
  await assert.rejects(student.currentUser());
  console.log('PASS: disabling access immediately blocks an existing session');
  await student.signOut();
  assert.equal(await student.currentUser(), null);
  console.log('PASS: logout clears the local session');
} finally {
  await Promise.allSettled([admin.signOut(), student.signOut(), staff.signOut()]);
}
