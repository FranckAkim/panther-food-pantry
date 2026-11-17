import { test } from "node:test";
import assert from "node:assert/strict";
import { getSupabaseConfig } from "../src/lib/supabase/config.js";

const valid = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
};

test("Supabase config uses Vite variables and reports missing configuration", () => {
  assert.deepEqual(getSupabaseConfig(valid), {
    url: valid.VITE_SUPABASE_URL,
    publishableKey: valid.VITE_SUPABASE_PUBLISHABLE_KEY,
  });
  assert.throws(() => getSupabaseConfig(), /Set VITE_SUPABASE_URL/);
  assert.throws(
    () =>
      getSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: valid.VITE_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: valid.VITE_SUPABASE_PUBLISHABLE_KEY,
      }),
    /Set VITE_SUPABASE_URL/,
  );
});

test("Supabase config rejects invalid or insecure remote URLs and accepts local development", () => {
  for (const url of ["not a URL", "http://example.supabase.co", "javascript:alert(1)"]) {
    assert.throws(
      () => getSupabaseConfig({ ...valid, VITE_SUPABASE_URL: url }),
      /VITE_SUPABASE_URL/,
    );
  }
  assert.equal(
    getSupabaseConfig({ ...valid, VITE_SUPABASE_URL: " http://127.0.0.1:54321/ " }).url,
    "http://127.0.0.1:54321",
  );
});

test("Supabase config prevents privileged keys from being used by the browser client", () => {
  for (const key of ["sb_secret_example", "eyJhbGciOiJIUzI1NiJ9.example"]) {
    assert.throws(
      () => getSupabaseConfig({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: key }),
      /publishable key/,
    );
  }
});
