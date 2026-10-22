// Live checks without creating accounts or sending email.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { liveTestConfig } from "./live/config.js";
const { url, key } = liveTestConfig();
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error } = await client.auth.signInWithPassword({
  email: "pantry-nonexistent-test@pvamu.edu",
  password: "invalid-test-password",
});
assert.equal(error?.code, "invalid_credentials");
const anonymous = await client.from("profiles").select("*");
assert.equal(
  anonymous.error?.code,
  "42501",
  "Anonymous profile access must be denied by permissions",
);
console.log("Live Auth rejects invalid credentials; anonymous Data API access denied.");
