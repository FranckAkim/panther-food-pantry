// Runs only against the named local CLI stack; never accepts a hosted URL or key.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createPantryApi } from "../src/lib/pantryApi.js";
import { loadWorkspace, report, today } from "../src/features/live/model.js";

const root = resolve(import.meta.dirname, "../..");
const cli = (command) =>
  process.platform === "win32"
    ? execFileSync(
        "powershell",
        ["-NoProfile", "-Command", `npx --yes supabase@3.2.0 ${command}`],
        { cwd: root, encoding: "utf8" },
      )
    : execFileSync("npx", ["--yes", "supabase@3.2.0", ...command.split(" ")], {
        cwd: root,
        encoding: "utf8",
      });
const config = JSON.parse(cli("status -o json"));
assert.equal(config.API_URL, "http://127.0.0.1:54321", "Only the isolated local API is permitted");
const container = "supabase_db_panther-food-pantry";
const sql = (statement) =>
  execFileSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
    { input: statement, encoding: "utf8" },
  ).trim();
assert.equal(sql("select current_database();"), "postgres");
const adminClient = createClient(config.API_URL, config.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const clients = [];
const make = () => {
  const client = createClient(config.API_URL, config.PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  clients.push(client);
  return { client, api: createPantryApi(client) };
};
const run = `connected-${Date.now()}`;
const ids = [];
const temp = await mkdtemp(join(tmpdir(), "pantry-connected-"));
const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};
const check = async (label, work) => {
  await work();
  console.log(`PASS ${label}`);
};
const accounts = [];
async function emailFor(address) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const inbox = await fetch("http://127.0.0.1:54324/api/v1/messages").then((r) => r.json());
    const message = inbox.messages.find((m) => m.To.some((t) => t.Address === address));
    if (message)
      return fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`).then((r) => r.json());
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Confirmation email did not reach the local test inbox");
}
const verifyLink = (message) => {
  const link = (message.HTML || message.Text).match(/https?:[^\s"<>]+\/auth\/v1\/verify[^\s"<>]+/);
  assert.ok(link, "Expected an Auth verification link in test inbox");
  return new URL(link[0].replaceAll("&amp;", "&"));
};
async function account(role, name = role) {
  const email = `${run}-${name.toLowerCase().replaceAll(" ", "-")}@pvamu.edu`,
    password = crypto.randomUUID() + "Aa1!";
  const { user } = unwrap(
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: name },
    }),
  );
  accounts.push(user.id);
  sql(`update private.user_access set role='${role}' where user_id='${user.id}';`);
  const { client, api } = make();
  await api.signIn({ email, password, workspace: role });
  return { email, password, id: user.id, name, client, api };
}
let browserError;
try {
  const admin = await account("admin"),
    staff = await account("staff"),
    student = await account("student"),
    other = await account("student", "other"),
    browserStudent = await account("student", "Browser student");
  const category = `Test ${run}`;
  await check("signup email delivery, confirmation link, and password reset", async () => {
    const member = make(),
      email = `${run}-signup@pvamu.edu`,
      password = crypto.randomUUID() + "Aa1!";
    const registered = await member.api.registerStudent({
      email,
      password,
      displayName: "Email test",
    });
    accounts.push(registered.user.id);
    assert.equal(registered.session, null, "Local email confirmation must be enabled");
    await assert.rejects(member.api.signIn({ email, password, workspace: "student" }));
    const link = verifyLink(await emailFor(email));
    unwrap(
      await member.client.auth.verifyOtp({
        token_hash: link.searchParams.get("token"),
        type: "signup",
      }),
    );
    await member.api.signOut();
    await member.api.signIn({ email, password, workspace: "student" });
    await member.api.requestPasswordReset(email, "http://127.0.0.1:4174");
    let reset;
    for (let attempt = 0; attempt < 30; attempt++) {
      const list = await fetch("http://127.0.0.1:54324/api/v1/messages").then((r) => r.json());
      const message = list.messages.find(
        (m) => m.To.some((t) => t.Address === email) && /reset/i.test(m.Subject),
      );
      if (message) {
        reset = await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`).then((r) =>
          r.json(),
        );
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.ok(reset, "Password reset email delivered locally");
    const resetLink = verifyLink(reset);
    unwrap(
      await member.client.auth.verifyOtp({
        token_hash: resetLink.searchParams.get("token"),
        type: "recovery",
      }),
    );
    const changed = crypto.randomUUID() + "Aa1!";
    await member.api.updatePassword(changed);
    await member.api.signOut();
    await assert.rejects(member.api.signIn({ email, password, workspace: "student" }));
    await member.api.signIn({ email, password: changed, workspace: "student" });
  });
  await check(
    "real staff provisioning function, invitation acceptance, and browser CORS",
    async () => {
      const origin = "http://127.0.0.1:4174",
        endpoint = config.API_URL + "/functions/v1/provision-staff";
      const preflight = await fetch(endpoint, {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization,apikey,content-type,x-client-info",
        },
      });
      assert.ok(preflight.ok);
      assert.ok([origin, "*"].includes(preflight.headers.get("access-control-allow-origin")));
      const session = unwrap(await admin.client.auth.getSession()).session;
      const forbidden = await fetch(endpoint, {
        method: "POST",
        headers: {
          Origin: "https://untrusted.invalid",
          Authorization: `Bearer ${session.access_token}`,
          apikey: config.PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: `${run}-forbidden-origin@pvamu.edu` }),
      });
      assert.equal(forbidden.status, 403);
      const invitation = await admin.api.provisionStaff({
        email: `${run}-invited@pvamu.edu`,
        displayName: "Invited staff",
      });
      accounts.push(invitation.userId);
      const invited = make(),
        link = new URL(invitation.invitationUrl);
      unwrap(
        await invited.client.auth.verifyOtp({
          token_hash: link.searchParams.get("token"),
          type: "invite",
        }),
      );
      const password = crypto.randomUUID() + "Aa1!";
      await invited.api.updatePassword(password);
      await invited.api.signOut();
      await invited.api.signIn({ email: `${run}-invited@pvamu.edu`, password, workspace: "staff" });
      await assert.rejects(student.api.provisionStaff({ email: `${run}-forbidden@pvamu.edu` }));
    },
  );
  const item = await staff.api.createItem({ name: `API item ${run}`, category, unit: "can" });
  ids.push(item.id);
  const slot = await staff.api.savePickupSlot({
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    capacity: 1,
  });
  const browserSlot = await staff.api.savePickupSlot({
    startsAt: new Date(Date.now() + 172800000).toISOString(),
    capacity: 5,
  });
  const donation = {
    id: crypto.randomUUID(),
    donor: run,
    receivedDate: today(),
    lines: [{ item_id: item.id, quantity: 2, storage_location: "Test", expiry_date: null }],
  };
  await check("donation retry adds stock exactly once", async () => {
    await staff.api.receiveDonation(donation);
    await staff.api.receiveDonation(donation);
    const lots = (await staff.api.listLots()).filter((l) => l.item_id === item.id);
    assert.equal(lots.length, 1);
    assert.equal(lots[0].qty_on_hand, 2);
  });
  await check("multi-line donation failure rolls back every lot", async () => {
    await assert.rejects(
      staff.api.receiveDonation({
        ...donation,
        id: crypto.randomUUID(),
        lines: [...donation.lines, { ...donation.lines[0], quantity: -1 }],
      }),
    );
    assert.equal((await staff.api.listLots()).filter((l) => l.item_id === item.id).length, 1);
  });
  await check(
    "anonymous, student inventory writes and forged direct request inserts are denied",
    async () => {
      const anon = make();
      await assert.rejects(anon.api.pickupSlots());
      await assert.rejects(student.api.createItem({ name: "Forbidden", category }));
      await assert.rejects(student.api.receiveDonation({ ...donation, id: crypto.randomUUID() }));
      const response = await student.client
        .from("food_requests")
        .insert({ requested_categories: [category] });
      assert.ok(response.error);
    },
  );
  let request;
  await check("concurrent students cannot overbook the final slot", async () => {
    const results = await Promise.allSettled(
      [student, other].map((s) =>
        s.api.reserveRequest({ id: crypto.randomUUID(), categories: [category], slotId: slot.id }),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    request = results.find((r) => r.status === "fulfilled").value;
    assert.equal((await staff.api.pickupSlots()).find((s) => s.id === slot.id).booked, 1);
  });
  const owner = request.student_id === student.id ? student : other,
    nonowner = owner === student ? other : student;
  await check("request ownership, duplicate prevention, and staff decisions", async () => {
    assert.equal((await nonowner.api.myRequests()).length, 0);
    await assert.rejects(nonowner.api.transitionRequest({ id: request.id, status: "cancelled" }));
    await assert.rejects(owner.api.transitionRequest({ id: request.id, status: "approved" }));
    await assert.rejects(
      owner.api.reserveRequest({
        id: crypto.randomUUID(),
        categories: [category],
        slotId: browserSlot.id,
      }),
    );
    await staff.api.transitionRequest({ id: request.id, status: "approved" });
    assert.equal((await owner.api.myRequests())[0].status, "approved");
  });
  await check("insufficient-stock pickup is atomic and requires verified ID", async () => {
    await assert.rejects(
      staff.api.completePickup({
        requestId: request.id,
        lines: [{ item_id: item.id, quantity: 1 }],
        idChecked: true,
      }),
    );
    await staff.api.setStudentId({
      userId: owner.id,
      studentId: `ID-${run}`,
      identificationChecked: true,
    });
    await assert.rejects(
      staff.api.completePickup({
        requestId: request.id,
        lines: [{ item_id: item.id, quantity: 3 }],
        idChecked: true,
      }),
    );
    assert.equal((await staff.api.listLots()).find((l) => l.item_id === item.id).qty_on_hand, 2);
  });
  await check("concurrent duplicate pickup completes once and reconciles stock", async () => {
    const payload = {
      requestId: request.id,
      lines: [{ item_id: item.id, quantity: 1 }],
      idChecked: true,
    };
    await Promise.all([staff.api.completePickup(payload), staff.api.completePickup(payload)]);
    const lot = (await staff.api.listLots()).find((l) => l.item_id === item.id);
    assert.equal(lot.qty_on_hand, 1);
    assert.equal(
      (await staff.api.stockHistory(lot.id)).reduce((s, a) => s + a.quantity_change, 0),
      1,
    );
    assert.equal((await owner.api.myRequests())[0].status, "completed");
  });
  await check("cancellation frees capacity once, declined requests cannot complete", async () => {
    const r = await owner.api.reserveRequest({
      id: crypto.randomUUID(),
      categories: [category],
      slotId: slot.id,
    });
    await owner.api.transitionRequest({ id: r.id, status: "cancelled" });
    await owner.api.transitionRequest({ id: r.id, status: "cancelled" });
    assert.equal((await staff.api.pickupSlots()).find((s) => s.id === slot.id).booked, 0);
    const next = await owner.api.reserveRequest({
      id: crypto.randomUUID(),
      categories: [category],
      slotId: slot.id,
    });
    await staff.api.transitionRequest({ id: next.id, status: "declined", note: "Test decline" });
    await assert.rejects(
      staff.api.completePickup({
        requestId: next.id,
        lines: [{ item_id: item.id, quantity: 1 }],
        idChecked: true,
      }),
    );
  });
  await check(
    "disabled sessions lose data access immediately and last admin is protected",
    async () => {
      await assert.rejects(
        admin.api.setUserAccess({ userId: admin.id, role: "student", enabled: false }),
      );
      await admin.api.setUserAccess({ userId: nonowner.id, role: "student", enabled: false });
      await assert.rejects(nonowner.api.currentUser(), /disabled/);
      assert.deepEqual(await nonowner.api.listRecords("food_requests"), []);
      await admin.api.setUserAccess({ userId: nonowner.id, role: "student", enabled: true });
    },
  );
  await check("reports reconcile received and distributed stock with audit", async () => {
    const loaded = await loadWorkspace(admin.api, "admin"),
      stats = report(loaded, "2000-01-01", "2999-12-31");
    assert.equal(stats.received, 2);
    assert.equal(stats.distributed, 1);
    assert.equal(stats.pickups, 1);
    assert.equal(loaded.audit.filter((a) => a.action === "complete_pickup").length, 1);
  });
  await check(
    "walk-ins require staff, cannot duplicate an open request, and record no-shows",
    async () => {
      await assert.rejects(
        student.api.createWalkIn({
          id: crypto.randomUUID(),
          studentId: student.id,
          categories: [category],
        }),
      );
      const id = crypto.randomUUID(),
        walk = await staff.api.createWalkIn({ id, studentId: student.id, categories: [category] });
      assert.equal(walk.status, "approved");
      await staff.api.createWalkIn({ id, studentId: student.id, categories: [category] });
      await assert.rejects(
        staff.api.createWalkIn({
          id: crypto.randomUUID(),
          studentId: student.id,
          categories: [category],
        }),
      );
      await staff.api.transitionRequest({ id: walk.id, status: "declined", note: "No-show" });
    },
  );
  await check("two independent pickups contend for the final unit with one winner", async () => {
    const requests = [];
    for (const [index, person] of [student, other].entries()) {
      await staff.api.setStudentId({
        userId: person.id,
        studentId: `RACE-${index}-${run}`,
        identificationChecked: true,
      });
      const r = await person.api.reserveRequest({
        id: crypto.randomUUID(),
        categories: [category],
        slotId: browserSlot.id,
      });
      await staff.api.transitionRequest({ id: r.id, status: "approved" });
      requests.push(r);
    }
    const outcomes = await Promise.allSettled(
      requests.map((r) =>
        staff.api.completePickup({
          requestId: r.id,
          lines: [{ item_id: item.id, quantity: 1 }],
          idChecked: true,
        }),
      ),
    );
    assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1);
    assert.equal((await staff.api.listLots()).find((l) => l.item_id === item.id).qty_on_hand, 0);
    const failed = requests[outcomes.findIndex((o) => o.status === "rejected")];
    await staff.api.transitionRequest({ id: failed.id, status: "declined", note: "Test cleanup" });
  });
  const browserItem = await staff.api.createItem({
    name: `Browser item ${run}`,
    category,
    unit: "can",
  });
  ids.push(browserItem.id);
  // The browser uses only public keys; privileged local keys stay in this Node process.
  await writeFile(
    resolve(root, "frontend/.env.local"),
    `VITE_SUPABASE_URL=${config.API_URL}\nVITE_SUPABASE_PUBLISHABLE_KEY=${config.PUBLISHABLE_KEY}\nVITE_PANTRY_MODE=live\n`,
  );
  const fixturePath = join(temp, "fixture.json");
  const publicAccount = ({ email, password, name }) => ({ email, password, name });
  await writeFile(
    fixturePath,
    JSON.stringify({
      admin: publicAccount(admin),
      browserStudent: publicAccount(browserStudent),
      browserItem: browserItem.id,
      browserSlot: browserSlot.id,
      category,
      run,
    }),
  );
  const node = process.execPath,
    frontend = resolve(root, "frontend");
  const build = spawnSync(node, ["node_modules/vite/bin/vite.js", "build"], {
    cwd: frontend,
    stdio: "inherit",
  });
  assert.equal(build.status, 0);
  const result = spawnSync(
    node,
    ["node_modules/@playwright/test/cli.js", "test", "--config", "playwright.connected.config.js"],
    {
      cwd: frontend,
      stdio: "inherit",
      env: { ...process.env, PANTRY_CONNECTED_FIXTURES: fixturePath },
    },
  );
  assert.equal(result.status, 0, "Connected browser tests failed");
  console.log("PASS connected browser tests");
} catch (error) {
  browserError = error;
} finally {
  for (const client of clients) await client.auth.signOut();
  // Browser registration/invitation accounts also belong to this exact local run.
  const created = unwrap(await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })).users;
  for (const user of created) {
    if (user.email?.startsWith(`${run}-`) && !accounts.includes(user.id)) accounts.push(user.id);
  }
  // Exact UUIDs generated by this run only; local container name is fixed above.
  if (accounts.length) {
    const users = accounts.map((id) => `'${id}'`).join(",");
    const items = ids.length ? ids.map((id) => `'${id}'`).join(",") : "null";
    sql(`begin;
      delete from public.pickup_lines where request_id in(select id from public.food_requests where student_id in(${users}));
      delete from public.food_requests where student_id in(${users});
      delete from public.donation_lines where donation_id in(select id from public.donations where actor_id in(${users}));
      delete from public.donations where actor_id in(${users});
      delete from public.stock_adjustments where actor_id in(${users});
      delete from public.inventory_lots where item_id in(${items});
      delete from public.inventory_items where id in(${items});
      delete from public.pickup_slots where id in(select record_id from public.operations_audit where actor_id in(${users}) and action='save_slot');
      delete from public.operations_audit where actor_id in(${users});
      delete from public.access_audit where actor_id in(${users}) or target_id in(${users});
      delete from public.student_id_audit where actor_id in(${users}) or target_id in(${users});
      commit;`);
    for (const id of accounts) unwrap(await adminClient.auth.admin.deleteUser(id));
    console.log("PASS local fixture cleanup");
  }
  await rm(temp, { recursive: true, force: true });
}
if (browserError) throw browserError;
