// Shared by the Vite browser client and the read-only connection check.
export function getSupabaseConfig(env = {}) {
  const url = env.VITE_SUPABASE_URL?.trim();
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error(
      "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in frontend/.env, then restart Vite.",
    );
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("VITE_SUPABASE_URL must be a valid Supabase project URL.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsedUrl.hostname);
  if (parsedUrl.protocol !== "https:" && !(local && parsedUrl.protocol === "http:")) {
    throw new Error("VITE_SUPABASE_URL must use HTTPS, except for local development.");
  }
  if (!publishableKey.startsWith("sb_publishable_")) {
    throw new Error(
      "Use a Supabase publishable key in the frontend, never a secret or service-role key.",
    );
  }

  return { url: url.replace(/\/+$/, ""), publishableKey };
}
