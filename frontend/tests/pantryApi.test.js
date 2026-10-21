import test from 'node:test';
import assert from 'node:assert/strict';
import { createPantryApi } from '../src/lib/pantryApi.js';

test('profile editing never sends student ID, even if supplied by a caller', async () => {
  let payload;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'student' } } }) },
    rpc: async () => ({ data: [{ role: 'student', enabled: true }] }),
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: {} }) }) }),
      update: value => { payload = value; return { eq: () => ({ select: () => ({ single: async () => ({ data: {} }) }) }) }; },
    }),
  };
  await createPantryApi(client).updateMyProfile({ displayName: 'Student', studentId: 'FORGED' });
  assert.deepEqual(payload, { display_name: 'Student' });
});
test('student ID assignment requires an explicit identification check', async () => {
  await assert.rejects(createPantryApi({}).setStudentId({ userId: 'student', studentId: 'P00012345' }), /physical/);
});
test('student ID helper calls the protected RPC and propagates authorization errors', async () => {
  let call;
  const api = createPantryApi({ rpc: async (name, args) => {
    call = { name, args }; return { data: { student_id: 'P00012345' } };
  } });
  await api.setStudentId({ userId: 'student', studentId: 'P00012345', identificationChecked: true });
  assert.deepEqual(call, { name: 'staff_set_student_id', args: { target: 'student', new_student_id: 'P00012345', identification_checked: true } });
  const denied = createPantryApi({ rpc: async () => ({ error: new Error('Staff access required') }) });
  await assert.rejects(denied.setStudentId({ userId: 'student', studentId: 'P00012345', identificationChecked: true }), /Staff/);
});

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
