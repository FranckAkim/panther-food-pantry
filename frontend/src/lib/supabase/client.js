import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config.js";

let client;

// Reuse one client so features share a session and a single refresh mechanism.
export function createClient() {
  if (!client) {
    const { url, publishableKey } = getSupabaseConfig(import.meta.env);
    client = createSupabaseClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Use query-string authorization codes without consuming app hash routes.
        flowType: "pkce",
      },
    });
  }
  return client;
}

export const supabase = createClient();
