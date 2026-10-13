import test from 'node:test';
import assert from 'node:assert/strict';
import { createPantryApi } from '../src/lib/pantryApi.js';

test('signed-out visitors have no current profile', async () => {
  const api = createPantryApi({ auth: { getUser: async () => ({ error: { name: 'AuthSessionMissingError' } }) } });
  assert.equal(await api.currentUser(), null);
});

test('non-university signup is rejected before calling Auth', async () => {
  const api = createPantryApi({});
  await assert.rejects(api.registerStudent({ email: 'someone@example.com', password: 'unused' }), /pvamu/);
});
test('signup sends display name but never a role', async () => {
  let payload;
  const api = createPantryApi({ auth: { signUp: async value => {
    payload = value; return { data: { user: {} } };
  } } });
  await api.registerStudent({ email: 'Student@PVAMU.edu', password: 'unused', displayName: 'Student' });
  assert.equal(payload.email, 'student@pvamu.edu');
  assert.deepEqual(payload.options.data, { display_name: 'Student' });
});
test('wrong-workspace login clears the local session', async () => {
  let signedOut = false;
  const api = createPantryApi({
    auth: {
      signInWithPassword: async () => ({ data: {} }),
      getUser: async () => ({ data: { user: { id: 'student' } } }),
      signOut: async () => { signedOut = true; return { data: {} }; },
    },
    rpc: async () => ({ data: [{ role: 'student', enabled: true }] }),
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: {} }) }) }) }),
  });
  await assert.rejects(api.signIn({ email: 'student@pvamu.edu', password: 'unused', workspace: 'staff' }), /workspace/);
  assert.equal(signedOut, true);
});
test('disabled users cannot retrieve their profile', async () => {
  const api = createPantryApi({
    auth: { getUser: async () => ({ data: { user: { id: 'disabled' } } }) },
    rpc: async () => ({ data: [{ role: null, enabled: false }] }),
  });
  await assert.rejects(api.currentUser(), /disabled/);
});
test('request submission does not send ownership or status', async () => {
  let payload;
  const api = createPantryApi({ from: () => ({ insert: value => {
    payload = value; return { select: () => ({ single: async () => ({ data: { id: 'request' } }) }) };
  } }) });
  await api.submitRequest({ categories: [' Produce ', 'Produce'], pickupNote: 'Afternoon' });
  assert.deepEqual(payload, { requested_categories: ['Produce'], pickup_note: 'Afternoon' });
});
test('empty categories and oversized notes are rejected', async () => {
  const api = createPantryApi({});
  await assert.rejects(api.submitRequest({ categories: [] }), /categories/);
  await assert.rejects(api.submitRequest({ categories: ['Produce'], pickupNote: 'x'.repeat(501) }), /500/);
});
