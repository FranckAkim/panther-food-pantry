// Only installs into this repository's local CLI container, never a hosted project.
import { execFileSync } from "node:child_process";
const container = "supabase_db_panther-food-pantry";
const query = execFileSync("docker", ["exec", container, "psql", "-U", "postgres", "-qAt", "-c", "select to_regclass('public.profiles');"], { encoding: "utf8" }).trim();
if (query) throw new Error("Local pantry schema already exists. Do not reinstall; use the existing local stack or recreate this disposable stack explicitly.");
execFileSync("docker", ["cp", "supabase", `${container}:/tmp/pantry`]);
execFileSync("docker", ["exec", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", ...["schema", "request_validation", "inventory", "workflows"].flatMap(name => ["-f", `/tmp/pantry/${name}.sql`])], { stdio: "inherit" });
console.log("PASS installed schema in the isolated local pantry database");
