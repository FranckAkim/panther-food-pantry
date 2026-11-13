import { loadEnv } from "vite";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "../src/lib/supabase/config.js";

// Check public API connectivity without creating accounts or reading pantry rows.
async function checkConnection() {
  const env = { ...loadEnv("development", process.cwd(), "VITE_"), ...process.env };
  const { url, publishableKey } = getSupabaseConfig(env);
  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: publishableKey },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Auth connection failed (HTTP ${response.status}).`);
  const settings = await response.json();
  if (typeof settings.external !== "object") {
    throw new Error("Auth returned an unexpected settings response.");
  }
  console.log(`Supabase project: ${new URL(url).hostname}`);
  console.log(`Auth: reachable; publishable key accepted (HTTP ${response.status})`);

  // Schema listing requires a server key. Query a known table directly instead,
  // with a zero-row limit so the check never fetches pantry records.
  const table = process.argv[2];
  if (table) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) throw new Error("Pass a valid table name.");
    const client = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error } = await client
      .from(table)
      .select("*")
      .limit(0)
      .abortSignal(AbortSignal.timeout(15000));
    if (error) throw new Error(`Data API (${table}): ${error.code || "error"} — ${error.message}`);
    console.log(`Data API (${table}): query accepted; no rows fetched.`);
  } else {
    console.log("To check an existing table: npm run supabase:check -- TABLE_NAME");
  }
  console.log(
    "Account permissions and authenticated pantry queries still need integration checks.",
  );
}

checkConnection().catch((error) => {
  console.error(`Supabase check failed: ${error.message}`);
  process.exitCode = 1;
});
