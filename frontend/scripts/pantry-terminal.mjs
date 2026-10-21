import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { createClient } from '@supabase/supabase-js';
import { createPantryApi } from '../src/lib/pantryApi.js';

// Public connection settings only. Passwords are prompted without echo and are
// kept in memory; the CLI never prints tokens or stores a login session.
const url = process.env.SUPABASE_URL || 'https://pvidoddlywstnowhcfyl.supabase.co';
const key = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_8DHTKww7F0OSt-8klBBnBg_aEDbmG8Y';
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const api = createPantryApi(client);
let muted = false;
const output = new Writable({ write(chunk, encoding, done) { if (!muted) process.stdout.write(chunk, encoding); done(); } });
const rl = createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
const ask = question => new Promise(resolve => rl.question(question, resolve));
async function password(question) {
  process.stdout.write(question);
  muted = true;
  const value = await ask('');
  muted = false;
  process.stdout.write('\n');
  return value;
}
const display = value => console.log(JSON.stringify(value, null, 2));
try {
  const mode = process.argv[2] || 'login';
  if (mode === 'register') {
    const email = await ask('University email: ');
    const displayName = await ask('Name: ');
    const secret = await password('Create a separate pantry password: ');
    await api.registerStudent({ email, password: secret, displayName });
    console.log('Registration submitted. Confirm your email before signing in.');
  } else {
    if (mode === 'accept-invite') {
      const invitation = new URL(await password('Private invitation URL (hidden): '));
      if (invitation.origin !== url || invitation.pathname !== '/auth/v1/verify' || invitation.searchParams.get('type') !== 'invite') {
        throw new Error('Expected an invitation URL from this Supabase project.');
      }
      const result = await client.auth.verifyOtp({ token_hash: invitation.searchParams.get('token'), type: 'invite' });
      if (result.error) throw result.error;
      const result2 = await client.auth.updateUser({ password: await password('Create a separate pantry password: ') });
      if (result2.error) throw result2.error;
      console.log('Invitation accepted and password set.');
    } else if (mode === 'login') {
      const email = await ask('Email: ');
      const secret = await password('Pantry password: ');
      const workspace = (await ask('Workspace [student/staff/admin]: ')).trim();
      const account = await api.signIn({ email, password: secret, workspace });
      console.log(`Signed in as ${account.role}.`);
    } else throw new Error('Use login, register, or accept-invite.');
    console.log('1 Profile | 2 List items | 3 Add item | 4 Add lot | 5 Adjust stock');
    console.log('6 Availability | 7 List users | 8 Create staff invitation | 9 Edit item');
    console.log('10 Edit lot | 11 Submit food request | 12 My requests | 13 Set role/access');
    console.log('14 Stock history | 15 Verify student ID (staff/admin) | 0 Logout');
    for (;;) {
      const action = (await ask('Action: ')).trim();
      try {
        if (action === '0') break;
        if (action === '1') { const { profile, role } = await api.currentUser(); display({ profile, role }); }
        else if (action === '2') display(await api.listItems());
        else if (action === '3') display(await api.createItem({ name: await ask('Item name: '), category: await ask('Category: '), unit: await ask('Unit (e.g. can): ') }));
        else if (action === '4') display(await api.createLot({ itemId: await ask('Item UUID: '), quantity: Number(await ask('Initial quantity: ')), storageLocation: await ask('Storage location: '), receivedDate: await ask('Received date YYYY-MM-DD: '), expiryDate: (await ask('Expiry date YYYY-MM-DD (blank if none): ')) || null }));
        else if (action === '5') display(await api.adjustStock({ lotId: await ask('Lot UUID: '), delta: Number(await ask('Quantity change (e.g. +5 or -2): ')), reason: await ask('Reason: ') }));
        else if (action === '6') display(await api.availableInventory());
        else if (action === '7') display(await api.listUsers());
        else if (action === '8') {
          const invitation = await api.provisionStaff({ email: await ask('Staff university email: '), displayName: await ask('Staff name: ') });
          console.log('Share this private invitation securely with that staff member; it grants access:'); display(invitation);
        }
        else if (action === '9') display(await api.updateItem(await ask('Item UUID: '), { name: await ask('Name: '), category: await ask('Category: '), unit: await ask('Unit: ') }));
        else if (action === '10') display(await api.updateLot(await ask('Lot UUID: '), { storageLocation: await ask('Storage location: '), receivedDate: await ask('Received date YYYY-MM-DD: '), expiryDate: (await ask('Expiry date (blank if none): ')) || null }));
        else if (action === '11') display(await api.submitRequest({ categories: (await ask('Categories, comma-separated: ')).split(','), pickupNote: await ask('Pickup note (optional): ') }));
        else if (action === '12') display(await api.myRequests());
        else if (action === '13') { await api.setUserAccess({ userId: await ask('User UUID: '), role: await ask('Role [student/staff/admin]: '), enabled: (await ask('Enabled? [yes/no]: ')) === 'yes' }); console.log('Access updated.'); }
        else if (action === '14') display(await api.stockHistory(await ask('Lot UUID: ')));
        else if (action === '15') display(await api.setStudentId({
          userId: await ask('Student account UUID: '), studentId: await ask('Student ID number: '),
          identificationChecked: (await ask('Have you checked this student’s physical ID? [yes/no]: ')).trim().toLowerCase() === 'yes',
        }));
        else console.log('Choose one of the listed actions.');
      } catch (error) { console.error('Operation failed:', error.message); }
    }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await client.auth.signOut({ scope: 'local' }); rl.close(); }
