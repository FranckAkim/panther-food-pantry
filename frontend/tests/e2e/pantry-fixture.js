// Deterministic HTTP fixtures for the connected UI. No shared accounts, keys, or server writes.
import { test as base, expect } from "@playwright/test";
import { createHash } from "node:crypto";
const apiOrigin = "https://pantry-browser-test.supabase.co";
const ids = {
  student: "11111111-1111-4111-8111-111111111111",
  staff: "22222222-2222-4222-8222-222222222222",
  admin: "33333333-3333-4333-8333-333333333333",
  item: "44444444-4444-4444-8444-444444444444",
  slot: "55555555-5555-4555-8555-555555555555",
};
export const fixturePassword = "BrowserFixtureOnly!2026";
const user = (role) => ({
  id: ids[role],
  email: `${role}@pvamu.edu`,
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
});
function session(role) {
  const jwt = {
    sub: ids[role],
    aud: "authenticated",
    role: "authenticated",
    email: user(role).email,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const token = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify(jwt)).toString("base64url"),
    "fixture-signature",
  ].join(".");
  return {
    access_token: token,
    refresh_token: `fixture-refresh-${role}`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: jwt.exp,
    user: user(role),
  };
}
export const test = base.extend({
  pantry: [
    async ({ page, baseURL }, use) => {
      const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", {
        timeZone: "America/Chicago",
      });
      const month = tomorrow.slice(0, 7);
      const state = {
        role: null,
        requests: [],
        donations: [],
        pickups: [],
        stock: 4,
        booked: 0,
        calls: [],
        unexpected: [],
        errors: [],
        challenge: null,
        expiredCode: false,
        failRequest: false,
      };
      const slot = {
        id: ids.slot,
        starts_at: `${tomorrow}T18:00:00Z`,
        ends_at: `${tomorrow}T18:30:00Z`,
        capacity: 2,
      };
      const profile = (role) => ({
        id: ids[role],
        display_name:
          role === "student" ? "Jordan Ellis" : role === "staff" ? "Dana Carter" : "Pantry Admin",
        student_id: role === "student" ? "P00281734" : null,
        claimed_student_id: null,
        photo_path: null,
      });
      const item = () => ({
        id: ids.item,
        name: "Canned beans",
        category: "Canned goods",
        unit: "can",
        active: true,
        low_stock_threshold: 2,
        image_path: null,
        inventory_lots: [
          {
            id: "66666666-6666-4666-8666-666666666666",
            qty_on_hand: state.stock,
            storage_location: "A1-1",
            received_date: "2026-01-01",
            expiry_date: "2099-01-01",
            received_quantity: 4,
            donation_id: null,
          },
        ],
      });
      const request = (status = "submitted") => ({
        id: "77777777-7777-4777-8777-777777777777",
        status,
        student_name: "Jordan Ellis",
        student_id: "P00281734",
        profile_id: ids.student,
        id_verified: true,
        first_visit: false,
        item_name: "Canned beans",
        categories: ["Canned goods"],
        slot_id: ids.slot,
        slot_starts_at: slot.starts_at,
        slot_ends_at: slot.ends_at,
        pickup_note: "",
        created_at: new Date().toISOString(),
        items: [],
      });
      page.on("pageerror", (e) => state.errors.push(e.message));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (url.origin === new URL(baseURL).origin) return route.continue();
        if (url.origin !== apiOrigin) {
          state.unexpected.push(req.url());
          return route.abort();
        }
        const body = req.postDataJSON() || {};
        const path = url.pathname;
        state.calls.push({ path, method: req.method(), body, query: url.search });
        const reply = (data, status = 200) =>
          route.fulfill({
            status,
            contentType: "application/json",
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify(data),
          });
        const reject = (message, status = 400, code = "23514") =>
          reply({ code, message, error_code: code, msg: message }, status);
        if (req.method() === "OPTIONS") return reply({});
        if (path === "/auth/v1/token") {
          if (url.searchParams.get("grant_type") === "pkce") {
            if (state.expiredCode) return reject("Code has expired", 400, "otp_expired");
            const expected = createHash("sha256")
              .update(body.code_verifier || "")
              .digest("base64url");
            if (!state.challenge || expected !== state.challenge)
              return reject("PKCE verifier mismatch");
            state.role = "student";
            return reply(session("student"));
          }
          if (url.searchParams.get("grant_type") === "refresh_token")
            return reply(session(state.role || "student"));
          if (body.password !== fixturePassword)
            return reject("Invalid login credentials", 400, "invalid_credentials");
          const role = body.email?.split("@")[0];
          if (!ids[role]) return reject("Invalid login credentials", 400, "invalid_credentials");
          state.role = role;
          return reply(session(role));
        }
        if (path === "/auth/v1/logout") {
          state.role = null;
          return reply({});
        }
        if (path === "/auth/v1/recover") {
          state.challenge = body.code_challenge;
          return reply({});
        }
        if (path === "/auth/v1/user") return reply(user(state.role || "student"));
        if (path === "/rest/v1/profiles") {
          if (url.searchParams.get("photo_path")?.startsWith("not.")) return reply([]);
          return reply([profile(state.role || "student")]);
        }
        if (path === "/rest/v1/inventory_items") return reply([item()]);
        if (path === "/rest/v1/donors") return reply([{ name: "Community donor" }]);
        if (path === "/rest/v1/donations") return reply(state.donations);
        if (path === "/rest/v1/stock_adjustments") return reply([]);
        const rpc = path.replace("/rest/v1/rpc/", "");
        switch (rpc) {
          case "my_access":
            return reply([{ role: state.role, enabled: Boolean(state.role) }]);
          case "my_food_requests":
          case "staff_list_requests":
            return reply(state.requests);
          case "available_inventory":
            return reply([
              {
                item_id: ids.item,
                name: "Canned beans",
                category: "Canned goods",
                unit: "can",
                available: true,
                image_path: null,
              },
            ]);
          case "category_availability":
            return reply([{ category: "Canned goods", status: "in_stock" }]);
          case "pickup_slot_availability":
            return reply([{ ...slot, booked: state.booked }]);
          case "submit_food_request":
            if (state.failRequest) return reject("This pickup time is full. Choose another time.");
            if (state.requests.some((r) => ["submitted", "approved"].includes(r.status)))
              return reject("You already have an open request");
            state.requests = [{ ...request(), pickup_note: body.p_note }];
            state.booked = 1;
            return reply(state.requests[0]);
          case "cancel_food_request":
            state.requests = state.requests.map((r) => ({ ...r, status: "cancelled" }));
            state.booked = 0;
            return reply(state.requests[0]);
          case "staff_decide_request":
            state.requests = state.requests.map((r) =>
              r.id === body.p_request_id
                ? {
                    ...r,
                    status: body.p_approve ? "approved" : "declined",
                    decline_reason: body.p_reason,
                  }
                : r,
            );
            return reply(state.requests[0]);
          case "staff_pickups":
            return reply(state.pickups);
          case "staff_find_student":
            return reply([
              {
                kind: "account",
                id: ids.student,
                full_name: "Jordan Ellis",
                student_id: "P00281734",
                id_verified: true,
                has_pickups: false,
              },
            ]);
          case "staff_complete_distribution": {
            const amount = body.p_items.reduce((sum, line) => sum + line.quantity, 0);
            if (amount > state.stock) return reject("Not enough stock is available.");
            state.stock -= amount;
            const distribution = {
              distribution_id: "99999999-9999-4999-8999-999999999999",
              request_id: body.p_request_id,
              kind: "account",
              recipient_id: ids.student,
              student_name: "Jordan Ellis",
              student_id: "P00281734",
              id_verified: true,
              first_visit: false,
              status: "completed",
              distributed_at: new Date().toISOString(),
              items: body.p_items.map((line) => ({ ...line, name: "Canned beans", unit: "can" })),
            };
            state.pickups.push(distribution);
            return reply({ id: distribution.distribution_id });
          }
          case "staff_list_students":
            return reply([]);
          case "admin_list_accounts":
            return reply(
              ["student", "staff", "admin"].map((role) => ({
                user_id: ids[role],
                display_name: profile(role).display_name,
                email: user(role).email,
                role,
                enabled: true,
                student_id: profile(role).student_id,
              })),
            );
          case "admin_report_months":
            return reply([month, "2026-01"]);
          case "admin_monthly_report":
            return reply({
              students: body.p_month === "2026-01-01" ? 2 : 5,
              completed: 3,
              units: 7,
              donations: 1,
              expired: 0,
              items: [],
              results: [],
              categories: [],
              weekly: [],
            });
          case "admin_audit_entries":
            return reply([]);
          case "staff_record_donation": {
            const quantity = body.p_lines.reduce((sum, l) => sum + l.quantity, 0);
            state.stock += quantity;
            const row = {
              id: "88888888-8888-4888-8888-888888888888",
              received_on: body.p_received_on,
              created_at: new Date().toISOString(),
              recorder: { display_name: "Dana Carter" },
              donation_donors: body.p_donors.map((name) => ({ donor: { name } })),
              inventory_lots: body.p_lines.map((l) => ({
                id: crypto.randomUUID(),
                received_quantity: l.quantity,
                expiry_date: l.expiry_date,
                storage_location: l.storage_location,
                item: { name: "Canned beans", unit: "can", image_path: null },
              })),
            };
            state.donations.unshift(row);
            return reply(row);
          }
          default:
            state.unexpected.push(`${req.method()} ${path}`);
            return reject(`Unhandled fixture: ${path}`, 500);
        }
      });
      await use({ ...state, state, ids, slot, tomorrow, request, profile });
      expect(state.unexpected, "No unexpected API or external requests").toEqual([]);
      expect(state.errors, "No uncaught browser errors").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };
export async function signIn(page, role = "student") {
  await page.goto(role === "student" ? "/#/sign-in" : `/#/${role}/sign-in`);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(`${role}@pvamu.edu`);
  await page.locator('input[name="password"]').fill(fixturePassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: role === "student" ? "Hi, Jordan" : "Dashboard",
      exact: true,
    }),
  ).toBeVisible();
}
