// Live checks without creating accounts or sending email.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const client = createClient('https://pvidoddlywstnowhcfyl.supabase.co',
  'sb_publishable_8DHTKww7F0OSt-8klBBnBg_aEDbmG8Y',
  { auth: { persistSession: false, autoRefreshToken: false } });
const { error } = await client.auth.signInWithPassword({
  email: 'pantry-nonexistent-test@pvamu.edu', password: 'invalid-test-password',
});
assert.equal(error?.code, 'invalid_credentials');
const anonymous = await client.from('profiles').select('*');
assert.ok(anonymous.error, 'Anonymous API must not expose profiles');
console.log('Live Auth rejects invalid credentials; anonymous Data API access denied.');
