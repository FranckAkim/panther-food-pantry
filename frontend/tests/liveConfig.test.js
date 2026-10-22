import test from "node:test";
import assert from "node:assert/strict";
import { liveTestConfig, validateLiveFixtures } from "./live/config.js";

const ref = "abcdefghijklmnopqrst";
const env = {
  PANTRY_TEST_PROJECT_REF: ref,
  PANTRY_TEST_URL: `https://${ref}.supabase.co`,
  PANTRY_TEST_PUBLISHABLE_KEY: "sb_publishable_example",
};

test("live tests have no default project or key", () => {
  assert.throws(() => liveTestConfig({}), /Set PANTRY_TEST/);
});

test("live tests refuse the shared pantry project", () => {
  assert.throws(
    () => liveTestConfig({ ...env, PANTRY_TEST_PROJECT_REF: "pvidoddlywstnowhcfyl" }),
    /shared pantry project/,
  );
});

test("live target must match the explicit HTTPS project origin", () => {
  for (const url of [
    "https://different-project.supabase.co",
    `http://${ref}.supabase.co`,
    `https://${ref}.supabase.co/path`,
    `https://${ref}.supabase.co?key=value`,
    `https://user:password@${ref}.supabase.co`,
  ]) {
    assert.throws(() => liveTestConfig({ ...env, PANTRY_TEST_URL: url }));
  }
  assert.equal(liveTestConfig(env).url, env.PANTRY_TEST_URL);
});

test("live tests accept publishable keys and reject privileged keys", () => {
  for (const key of ["sb_secret_example", "service_role", "legacy.jwt.key"]) {
    assert.throws(
      () => liveTestConfig({ ...env, PANTRY_TEST_PUBLISHABLE_KEY: key }),
      /publishable key/,
    );
  }
});

test("fixtures must belong to the selected project and disposable run", () => {
  const account = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "qa-run-12345@pvamu.edu",
    password: "example-password-only",
  };
  const fixtures = {
    projectRef: ref,
    run: "run-12345",
    admin: account,
    student: account,
    staffEmail: "staff-run-12345@pvamu.edu",
    staffPassword: "example-password-only",
  };
  assert.doesNotThrow(() => validateLiveFixtures(fixtures, liveTestConfig(env)));
  assert.throws(() =>
    validateLiveFixtures({ ...fixtures, projectRef: "other" }, liveTestConfig(env)),
  );
  assert.throws(() =>
    validateLiveFixtures({ ...fixtures, run: "unrelated-run" }, liveTestConfig(env)),
  );
});
