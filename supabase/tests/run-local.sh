#!/usr/bin/env bash
# Applies every migration to a throwaway local Postgres (with a minimal Supabase shim)
# and runs the pantry SQL tests. Requires Postgres 15+ client and server binaries.
#   supabase/tests/run-local.sh
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
WORK=$(mktemp -d)
PORT=${PANTRY_TEST_PORT:-55432}
cleanup() {
  pg_ctl -D "$WORK/data" stop -m fast >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

initdb -D "$WORK/data" -U postgres -A trust >/dev/null
pg_ctl -D "$WORK/data" -l "$WORK/postgres.log" -w \
  -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" start >/dev/null
PSQL=(psql -h 127.0.0.1 -p "$PORT" -U postgres -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" -f "$ROOT/supabase/tests/supabase_shim.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$migration")"
  "${PSQL[@]}" -1 -f "$migration"
done
for test in "$ROOT"/supabase/tests/*.test.sql; do
  echo "Running $(basename "$test")"
  # Query results are discarded; failures print to stderr and stop the run.
  "${PSQL[@]}" -o /dev/null -f "$test"
done
echo "All pantry SQL tests passed."
