import test from "node:test";
import assert from "node:assert/strict";
import { withCors } from "../../supabase/functions/provision-staff/cors.mjs";
import { createStaffHandler } from "../../supabase/functions/provision-staff/handler.mjs";
const origin = "http://127.0.0.1:4173";
const req = (headers = {}, method = "POST") =>
  new Request("https://example.test", { method, headers: { Origin: origin, ...headers } });
test("allowed preflight never invokes authorization or provisioning", async () => {
  const handler = withCors(() => assert.fail("preflight reached handler"), [origin]);
  const result = await handler(
    req(
      {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization, apikey, content-type, x-client-info",
      },
      "OPTIONS",
    ),
  );
  assert.equal(result.status, 204);
  assert.equal(result.headers.get("access-control-allow-origin"), origin);
  assert.equal(result.headers.get("access-control-allow-credentials"), null);
});
test("unknown origins and unconfigured browser access are denied before handler", async () => {
  for (const origins of [[], ["https://other.example"]]) {
    const result = await withCors(
      () => assert.fail("denied origin reached handler"),
      origins,
    )(req());
    assert.equal(result.status, 403);
    assert.equal(result.headers.get("access-control-allow-origin"), null);
  }
});
test("preflight rejects other methods and unexpected headers", async () => {
  const handler = withCors(() => assert.fail("preflight reached handler"), [origin]);
  for (const headers of [
    { "Access-Control-Request-Method": "DELETE" },
    { "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "x-untrusted" },
  ]) {
    assert.equal((await handler(req(headers, "OPTIONS"))).status, 403);
  }
});
test("browser errors retain CORS and do not expose internal failures", async () => {
  for (const [handler, status] of [
    [createStaffHandler({}), 401],
    [
      () => {
        throw new Error("secret");
      },
      503,
    ],
  ]) {
    const result = await withCors(handler, [origin])(req());
    assert.equal(result.status, status);
    assert.equal(result.headers.get("access-control-allow-origin"), origin);
    assert.equal(result.headers.get("vary"), "Origin");
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.ok(!(await result.text()).includes("secret"));
  }
});
test("non-browser callers retain authorization requirements", async () => {
  assert.equal(
    (
      await withCors(createStaffHandler({}))(
        new Request("https://example.test", { method: "POST" }),
      )
    ).status,
    401,
  );
});
test("configuration rejects wildcards, null, paths and credentials", () => {
  for (const invalid of ["*", "null", "https://example.test/path", "https://user@example.test"]) {
    assert.throws(() => withCors(() => {}, [invalid]));
  }
});
