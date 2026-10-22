import test from "node:test";
import assert from "node:assert/strict";
import { createStaffHandler } from "../../supabase/functions/provision-staff/handler.mjs";
const request = (body, token = "valid") =>
  new Request("https://example.test", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : {},
    body: JSON.stringify(body),
  });
function clients(role = "admin", enabled = true) {
  return {
    userClient: {
      auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) },
      rpc: async (name) => (name === "my_access" ? { data: [{ role, enabled }] } : { data: null }),
    },
    adminClient: {
      auth: {
        admin: {
          generateLink: async () => ({
            data: {
              user: { id: "staff" },
              properties: { action_link: "https://example.test/private-invite" },
            },
          }),
        },
      },
    },
  };
}
test("staff provisioning rejects missing authentication", async () => {
  assert.equal((await createStaffHandler(clients())(request({}, null))).status, 401);
});
test("students and disabled administrators cannot provision staff", async () => {
  for (const [role, enabled] of [
    ["student", true],
    ["staff", true],
    ["admin", false],
  ]) {
    assert.equal(
      (await createStaffHandler(clients(role, enabled))(request({ email: "staff@pvamu.edu" })))
        .status,
      403,
    );
  }
});
test("provisioning validates university email", async () => {
  assert.equal(
    (await createStaffHandler(clients())(request({ email: "staff@example.com" }))).status,
    400,
  );
});
test("administrator creates a staff invitation without sending email", async () => {
  const result = await createStaffHandler(clients())(request({ email: "staff@pvamu.edu" }));
  assert.equal(result.status, 201);
  assert.equal((await result.json()).role, "staff");
});
test("failed role assignment reports incomplete provisioning", async () => {
  const dependencies = clients();
  const original = dependencies.userClient.rpc;
  dependencies.userClient.rpc = (name) =>
    name === "my_access" ? original(name) : { error: new Error("Denied") };
  const result = await createStaffHandler(dependencies)(request({ email: "staff@pvamu.edu" }));
  assert.equal(result.status, 409);
});
