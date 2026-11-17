// Disposable, network-isolated verification of the migrations used by the hosted API.
import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
const container = `pantry-contract-${randomUUID()}`;
function docker(args) {
  const result = spawnSync("docker", args, { encoding: "utf8", timeout: 120000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Docker failed");
  return result.stdout;
}
const sql = (...args) => docker(["exec", container, "psql", "-h", "127.0.0.1", "-U", "postgres", "-X", "-q", "-v", "ON_ERROR_STOP=1", ...args]);
let created = false;
try {
  docker(["run", "-d", "--name", container, "--network", "none", "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:16"]);
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { sql("-c", "select 1"); ready = true; break; } catch { await delay(500); }
  }
  if (!ready) throw new Error("Disposable PostgreSQL did not become ready over TCP");
  for (const folder of ["migrations", "tests"]) {
    docker(["cp", fileURLToPath(new URL(`../supabase/${folder}`, import.meta.url)), `${container}:/tmp/${folder}`]);
  }
  sql("-f", "/tmp/tests/supabase_shim.sql");
  for (const name of (await readdir(new URL("../supabase/migrations/", import.meta.url))).filter(n => n.endsWith(".sql")).sort()) {
    sql("-1", "-f", `/tmp/migrations/${name}`);
    console.log(`PASS migration ${name}`);
  }
  for (const name of (await readdir(new URL("../supabase/tests/", import.meta.url))).filter(n => n.endsWith(".test.sql")).sort()) {
    sql("-f", `/tmp/tests/${name}`);
    console.log(`PASS ${name}`);
  }
} finally {
  if (created) { docker(["rm", "-f", "-v", container]); console.log("Removed disposable test database"); }
}
