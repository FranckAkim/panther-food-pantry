// Local SQL contract tests. Docker creates a fresh database with no network access.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const container = `pantry-sql-${randomUUID()}`;
const sources = fileURLToPath(new URL("../supabase", import.meta.url));
let created = false;

function docker(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "",
      stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Docker timed out: ${args[0]}`));
    }, 120_000);
    child.stdout.on("data", (data) => {
      stdout += data;
    });
    child.stderr.on("data", (data) => {
      stderr += data;
    });
    child.stdin.on("error", (error) => {
      if (error.code !== "EPIPE") reject(error);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
    child.stdin.end(input);
  });
}

async function checked(args, input) {
  const result = await docker(args, input);
  assert.equal(result.code, 0, result.stderr || result.stdout);
  return result.stdout;
}

const sqlArgs = [
  "exec",
  "-i",
  container,
  "psql",
  "-U",
  "postgres",
  "-X",
  "-qAt",
  "-v",
  "ON_ERROR_STOP=1",
  "-v",
  "VERBOSITY=verbose",
];
const sql = (statement) => checked(sqlArgs, statement);

try {
  // Trust is confined to this network-disabled container, with no published port.
  await checked([
    "run",
    "-d",
    "--name",
    container,
    "--network",
    "none",
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "postgres:16",
  ]);
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if ((await docker(["exec", container, "pg_isready", "-U", "postgres"])).code === 0) {
      ready = true;
      break;
    }
    await delay(500);
  }
  assert.ok(ready, "PostgreSQL did not become ready");
  await checked(["cp", sources, `${container}:/tmp/supabase`]);
  await checked([
    ...sqlArgs,
    "-f",
    "/tmp/supabase/tests/local-auth.sql",
    "-f",
    "/tmp/supabase/schema.sql",
    "-f",
    "/tmp/supabase/request_validation.sql",
    "-f",
    "/tmp/supabase/inventory.sql",
  ]);
  console.log("PASS fresh schema installation");
  for (const suite of ["access", "inventory"]) {
    const output = await checked([...sqlArgs, "-f", `/tmp/supabase/tests/${suite}.sql`]);
    assert.match(output, /tests passed; fixtures rolled back/);
    console.log(`PASS ${suite} SQL suite`);
  }
  assert.equal(
    (
      await sql(
        "select count(*) from auth.users; select count(*) from public.food_requests; select count(*) from public.inventory_lots;",
      )
    ).trim(),
    "0\n0\n0",
  );
  console.log("PASS SQL suite fixture rollback");
  const staff = randomUUID(),
    item = randomUUID();
  const claims = JSON.stringify({ sub: staff, role: "authenticated" });
  const authenticated = `set local role authenticated; select set_config('request.jwt.claims','${claims}',true);`;
  await sql(`insert into auth.users(id,email) values('${staff}','local-race-test@pvamu.edu');
    update private.user_access set role='staff' where user_id='${staff}';
    insert into public.inventory_items(id,name,category) values('${item}','Race test','Test');
    begin; ${authenticated}
    select public.create_inventory_lot('${item}',1,'Test shelf',current_date,null); commit;`);
  const lot = (await sql(`select id from public.inventory_lots where item_id='${item}';`)).trim();
  // Independent connections compete for the same row. The winner holds its lock.
  const attempts = await Promise.all(
    [1, 2].map((worker) =>
      docker(
        sqlArgs,
        `begin; set local statement_timeout='10s'; ${authenticated}
     select public.adjust_inventory_stock('${lot}',-1,'Parallel worker ${worker}');
     select pg_sleep(1); commit;`,
      ),
    ),
  );
  assert.equal(attempts.filter((result) => result.code === 0).length, 1, JSON.stringify(attempts));
  const rejected = attempts.find((result) => result.code !== 0);
  assert.match(rejected.stderr, /23514.*Stock change exceeds quantity limits/);
  assert.equal(
    (
      await sql(`select l.qty_on_hand, sum(a.quantity_change), count(*)
    from public.inventory_lots l join public.stock_adjustments a on a.lot_id=l.id
    where l.id='${lot}' group by l.id;`)
    ).trim(),
    "0|0|2",
  );
  console.log(
    "PASS concurrent final-unit decrement: one success, one rejection; stock and ledger zero",
  );
  const security =
    await sql(`select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;
    select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prosecdef
    and not exists(select 1 from unnest(p.proconfig) setting where setting in ('search_path=""','search_path='));
    select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and has_function_privilege('anon',p.oid,'EXECUTE');`);
  assert.equal(security.trim(), "0\n0\n0");
  console.log("PASS RLS coverage, privileged search paths, and anonymous function restrictions");
} finally {
  if (created) {
    await checked(["rm", "-f", "-v", container]);
    console.log("Removed disposable database and its anonymous volume");
  }
}
