import test from "node:test";
import assert from "node:assert/strict";
import { preflightProblem } from "./live/cors.js";

const origin = "http://127.0.0.1:4173";
const allowed = {
  "access-control-allow-origin": origin,
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "Authorization, apikey, Content-Type, X-Client-Info",
};

test("browser preflight accepts a matching origin or wildcard with all requested headers", () => {
  assert.equal(preflightProblem(204, new Headers(allowed), origin), null);
  assert.equal(
    preflightProblem(200, new Headers({ ...allowed, "access-control-allow-origin": "*" }), origin),
    null,
  );
});

test("browser preflight rejects HTTP errors even when CORS headers exist", () => {
  assert.match(preflightProblem(405, new Headers(allowed), origin), /HTTP 405/);
});

test("browser preflight rejects missing or mismatched allowed origins", () => {
  assert.match(preflightProblem(200, new Headers(), origin), /Origin/);
  assert.match(
    preflightProblem(
      200,
      new Headers({ ...allowed, "access-control-allow-origin": "https://other.example" }),
      origin,
    ),
    /Origin/,
  );
});

test("browser preflight requires POST and all bearer-client headers", () => {
  assert.match(
    preflightProblem(
      200,
      new Headers({ ...allowed, "access-control-allow-methods": "GET" }),
      origin,
    ),
    /POST/,
  );
  assert.match(
    preflightProblem(
      200,
      new Headers({ ...allowed, "access-control-allow-headers": "content-type" }),
      origin,
    ),
    /authorization, apikey, x-client-info/,
  );
});
