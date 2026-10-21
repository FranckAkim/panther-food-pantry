import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { createStaffHandler } from './handler.mjs';

Deno.serve(async request => {
  // The gateway JWT check is disabled for modern Auth signing keys. Every request
  // is independently verified by Auth.getUser and live database admin-role checks.
  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: request.headers.get('Authorization') || '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try { return await createStaffHandler({ userClient, adminClient })(request); }
  catch { return new Response(JSON.stringify({ error: 'Account service unavailable' }), {
    status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  }); }
});
