# DevOps test baseline

Run date: October 22, 2026. Based on merged `main` commit `aae222b`, plus the
test/tooling changes on this branch. Frontend commands ran on Windows Node 24;
the production Docker build uses the project's Node 22 and Python 3.12 images.
Local Python checks used Python 3.12 in a dedicated virtual environment.

## Results

| Area | Checks performed | Result |
| --- | --- | --- |
| Frontend domain/helpers | `npm test`: mock users/access, reports/audit, stock distribution, pickup dates, persistence, Supabase helpers, staff handler | 32 passed |
| Frontend bundle | `npm run build` | Passed |
| Backend lint/style | `ruff check .` and `ruff format --check .` | Passed |
| Backend HTTP tests | Process health, OpenAPI, database readiness success/failure, liveness during database failure | 4 passed; one upstream Starlette/AnyIO deprecation warning |
| Compose configuration | `docker compose config --quiet` | Passed; validates configuration, not the full hot-reload stack |
| Production image | `docker build -t panther-food-pantry:devops-test .` | Passed with Linux Node 22/Python 3.12 |
| Container smoke | Health JSON, React HTML, five referenced JS/CSS assets, public SVG, OpenAPI/docs, missing API/asset 404s | Passed |
| Container user | `docker exec <container> id -u` | UID 1000; non-root |
| PostgreSQL readiness | Isolated PostgreSQL 16 and production app containers; separate app with no reachable DB | HTTP 200/`database: ok` with DB; HTTP 503/`database: unreachable` without DB |
| Frontend formatting | Prettier check with `--end-of-line auto` to account for Windows checkout line endings | Six existing files need formatting; listed below |
| Hosted Supabase | SQL policies, real Auth accounts, invitations, concurrent cloud stock changes | Not run in this baseline; requires a designated test project and private temporary fixtures |

Formatting findings are in `frontend/src/lib/pantryApi.js`,
`frontend/src/lib/supabase.js`, `frontend/tests/auth-smoke.mjs`,
`frontend/tests/live-backend.mjs`, `frontend/tests/pantryApi.test.js`, and
`frontend/tests/staffProvisioning.test.js`. These predate this branch. The existing
CI workflow does not enforce frontend formatting. Avoid treating the passing
helper tests as evidence of a fully connected UI or live Supabase validation.

## Repeat the automated checks

From `frontend/`:

```sh
npm ci
npm test
npm run build
npm run format:check
```

From `backend/`, using Python 3.12 and an activated virtual environment:

```sh
python -m pip install -r requirements-dev.txt
python -m ruff check .
python -m ruff format --check .
python -m pytest -q
```

From the repository root (requires Docker and Node 22):

```sh
docker compose config --quiet
docker build -t panther-food-pantry:test .
docker run -d --name pantry-smoke -p 127.0.0.1:8000:8000 panther-food-pantry:test
node scripts/smoke-test.mjs
docker logs pantry-smoke
docker rm -f pantry-smoke
```

Use an unused container name/port if needed. The smoke script defaults to port
8000, retries health while the server starts, then fails on incorrect responses.
Override `PANTRY_SMOKE_URL` for a different port. In PowerShell:

```powershell
$env:PANTRY_SMOKE_URL = 'http://127.0.0.1:18080'
node scripts/smoke-test.mjs
```

CI runs the smoke script against the production image, logs the container on
failure, and removes it even if the check fails. `.dockerignore` excludes local
dependencies, virtual environments, generated bundles, and private env files
from the build context. The image installs its own Linux dependencies.

## Next test stages

1. Resolve the six formatting findings before enabling a formatting CI gate.
2. Add repeatable browser workflow tests for sign-in, requests/cancellation,
   pickup completion, donations, admin dialogs, report filters, and pagination.
3. Use a designated Supabase test project and provision disposable student,
   staff, and admin identities. Run the SQL tests and live runner described in
   [the backend guide](supabase-backend.md), with explicit fixture cleanup.
4. After UI integration, test the real request/stock contracts and concurrent
   operations through the application, including disabled accounts and denied roles.

The existing manual browser checks from the frontend PR review are separate from
this baseline; no browser automation suite or hosted-backend run is claimed here.
