// Dependency injection keeps authorization testable without real accounts.
export function createStaffHandler({ userClient, adminClient }) {
  const reply = (status, value) => new Response(JSON.stringify(value), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  return async request => {
    if (request.method !== 'POST') return reply(405, { error: 'POST required' });
    if (!/^Bearer\s+\S+$/i.test(request.headers.get('authorization') || '')) {
      return reply(401, { error: 'Sign in as an administrator first' });
    }
    const token = request.headers.get('authorization').replace(/^Bearer\s+/i, '');
    const auth = await userClient.auth.getUser(token);
    if (auth.error || !auth.data?.user) return reply(401, { error: 'Invalid session' });
    const access = await userClient.rpc('my_access');
    if (access.error || !access.data?.[0]?.enabled || access.data[0].role !== 'admin') {
      return reply(403, { error: 'Administrator access required' });
    }
    let body;
    try { body = await request.json(); } catch { return reply(400, { error: 'JSON body required' }); }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    if (!/^[^@\s]+@pvamu\.edu$/.test(email) || displayName.length > 100) {
      return reply(400, { error: 'A pvamu.edu email and name of at most 100 characters are required' });
    }
    // Generates a private invitation link without sending email. The administrator
    // shares it securely; SMTP is not required. Public signup still defaults to student.
    const invitation = await adminClient.auth.admin.generateLink({
      type: 'invite', email, options: { data: { display_name: displayName } },
    });
    if (invitation.error) return reply(409, { error: 'Unable to provision this account; it may already exist' });
    const userId = invitation.data.user?.id;
    if (!userId) return reply(502, { error: 'Account provider returned an incomplete response' });
    const roleChange = await userClient.rpc('admin_set_access', {
      target_user_id: userId, new_role: 'staff', new_enabled: true,
    });
    if (roleChange.error) {
      // Do not delete a possibly existing account. Role assignment can be retried.
      return reply(409, { error: 'Account exists but staff role assignment failed. Retry role management.', userId });
    }
    return reply(201, { userId, role: 'staff', invitationUrl: invitation.data.properties.action_link });
  };
}
