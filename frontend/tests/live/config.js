// No network requests or default project: live tests must name their target.
export function liveTestConfig(env = process.env) {
  const ref = env.PANTRY_TEST_PROJECT_REF;
  const url = env.PANTRY_TEST_URL;
  const key = env.PANTRY_TEST_PUBLISHABLE_KEY;
  if (!ref || !url || !key) {
    throw new Error(
      "Set PANTRY_TEST_PROJECT_REF, PANTRY_TEST_URL, and PANTRY_TEST_PUBLISHABLE_KEY for an isolated test project.",
    );
  }
  if (ref === "pvidoddlywstnowhcfyl") {
    throw new Error("Live tests must not target the shared pantry project.");
  }
  if (!/^[a-z0-9]{20}$/.test(ref)) throw new Error("Invalid test project reference.");
  const target = new URL(url);
  if (
    target.protocol !== "https:" ||
    target.hostname !== `${ref}.supabase.co` ||
    target.port ||
    target.username ||
    target.password ||
    target.pathname !== "/" ||
    target.search ||
    target.hash
  ) {
    throw new Error("Test URL must be the HTTPS origin for PANTRY_TEST_PROJECT_REF.");
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    throw new Error("Use the test project's publishable key, never a secret/service-role key.");
  }
  return { ref, url: target.origin, key };
}

export function validateLiveFixtures(fixtures, config) {
  if (fixtures.projectRef !== config.ref) {
    throw new Error("Fixture projectRef does not match the selected test project.");
  }
  if (!/^[a-z0-9-]{8,64}$/.test(fixtures.run || "")) {
    throw new Error("Use a unique lowercase run marker of 8–64 letters, numbers, or hyphens.");
  }
  const accounts = [fixtures.admin, fixtures.student];
  for (const account of accounts) {
    if (
      !account?.id ||
      !/^[0-9a-f-]{36}$/i.test(account.id) ||
      !account.email?.endsWith("@pvamu.edu") ||
      !account.email.includes(fixtures.run) ||
      typeof account.password !== "string" ||
      account.password.length < 12
    ) {
      throw new Error(
        "Admin/student fixtures must be disposable run-marked accounts with UUIDs and passwords.",
      );
    }
  }
  if (
    !fixtures.staffEmail?.endsWith("@pvamu.edu") ||
    !fixtures.staffEmail.includes(fixtures.run) ||
    typeof fixtures.staffPassword !== "string" ||
    fixtures.staffPassword.length < 12
  ) {
    throw new Error("Staff fixture must use a disposable run-marked email and password.");
  }
}
