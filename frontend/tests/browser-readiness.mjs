// Read-only transport check. Does not create users, send email, or change data.
import { liveTestConfig } from "./live/config.js";
import { browserHeaders, preflightProblem } from "./live/cors.js";

const { url } = liveTestConfig();
const origin = process.env.PANTRY_TEST_APP_ORIGIN;
if (!origin) throw new Error("Set PANTRY_TEST_APP_ORIGIN to the browser application's origin.");
const application = new URL(origin);
if (!["http:", "https:"].includes(application.protocol) || application.origin !== origin) {
  throw new Error(
    "PANTRY_TEST_APP_ORIGIN must be an HTTP(S) origin without a path or credentials.",
  );
}

let failures = 0;
for (const path of [
  "/auth/v1/token?grant_type=password",
  "/rest/v1/rpc/available_inventory",
  "/functions/v1/provision-staff",
]) {
  try {
    const response = await fetch(new URL(path, url), {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": browserHeaders.join(","),
      },
      signal: AbortSignal.timeout(15000),
    });
    const problem = preflightProblem(response.status, response.headers, origin);
    if (problem) throw new Error(problem);
    console.log(`PASS ${path}: browser preflight allowed`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${path}: ${error.message}`);
  }
}
if (failures) process.exitCode = 1;
