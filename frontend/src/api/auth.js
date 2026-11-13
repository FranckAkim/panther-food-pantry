import { rpc, run, supabase, toUserError } from "./client.js";

const roleNames = { student: "student", staff: "staff", admin: "admin" };

function authError(error) {
  const message = error?.message || "";
  if (/invalid login credentials/i.test(message))
    return new Error("Email or password is incorrect for this portal.");
  if (/email not confirmed/i.test(message))
    return new Error("Confirm your email address first. Check your inbox for the link we sent.");
  if (/already registered|already been registered/i.test(message))
    return new Error("An account with this email already exists. Sign in instead.");
  if (error?.status === 429 || /rate limit|too many/i.test(message))
    return new Error("Too many attempts. Wait a minute and try again.");
  if (/database error saving new user/i.test(message))
    return new Error("Use your Prairie View A&M email address ending in @pvamu.edu.");
  return toUserError(error);
}

/** The signed-in account with its pantry role, or null when signed out. */
export async function fetchAccount() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  const [access, profile] = await Promise.all([
    rpc("my_access"),
    run(
      supabase
        .from("profiles")
        .select("id, display_name, student_id, claimed_student_id")
        .eq("id", session.user.id)
        .maybeSingle(),
    ),
  ]);
  const role = access?.[0]?.role || null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: profile?.display_name || session.user.email,
    role,
    enabled: Boolean(access?.[0]?.enabled),
    studentId: profile?.student_id || profile?.claimed_student_id || "",
    studentIdVerified: Boolean(profile?.student_id),
  };
}

/** Signs in and checks the account is active and belongs to this portal. */
export async function signIn({ email, password, portal }) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw authError(error);
  const account = await fetchAccount();
  if (!account?.enabled) {
    await supabase.auth.signOut();
    throw new Error("This account is inactive. Contact a pantry administrator.");
  }
  if (account.role !== portal) {
    await supabase.auth.signOut();
    throw new Error(
      `This is a ${roleNames[account.role] || "pantry"} account. Use the ${roleNames[account.role] || "correct"} sign-in instead.`,
    );
  }
  return account;
}

/**
 * Creates a student account. Returns { account } when signed in right away, or
 * { needsConfirmation: true } when the project requires email confirmation first.
 */
export async function register({ name, studentId, email, password }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: name, student_id: studentId },
      emailRedirectTo: `${window.location.origin}/`,
    },
  });
  if (error) throw authError(error);
  if (!data.session) return { needsConfirmation: true };
  return { account: await fetchAccount() };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw authError(error);
}

export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/`,
  });
  if (error) throw authError(error);
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw authError(error);
}
