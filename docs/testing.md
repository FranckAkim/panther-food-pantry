# DevOps test baseline

## Hosted Supabase follow-up — October 22, 2026

The live checks passed against the separately owned test project
`bydaysnwrxkkzwnnqscq`, not the shared pantry project. The target was inspected as
empty before installing the schema and deploying the staff function.

| Area | Observed result |
| --- | --- |
| SQL access and inventory suites | Both passed; transactional fixtures rolled back |
| Anonymous API and invalid credentials | Access denied / invalid credentials as expected |
| Real password authentication | Disposable admin, student, and invited staff accounts signed in |
| Staff provisioning | Admin generated an invitation; staff accepted it and set a password; student provisioning was rejected |
| Inventory and availability | Item/lot create and update, audited stock adjustment, student-safe availability, unauthorized writes rejected |
| Concurrent final-unit decrement | Two parallel HTTP calls: exactly one success and one rejection; final quantity and ledger sum both zero |
| Requests and disabled access | Student submitted with server-owned identity; staff read authorized requests; disabled student's existing session immediately lost pantry access |
| Logout and cleanup | Sessions signed out; run-owned accounts, records and audit fixtures removed; all pantry-table and Auth user/session counts verified zero |

Admin/student fixtures were temporarily seeded as confirmed Auth users and email
identities in the test database with random bcrypt-hashed passwords; the staff
identity was created through the real application invitation flow. This verifies
password Auth and invitation acceptance, but does not verify signup email delivery
or campus SSO. No confirmation settings were disabled and no email was sent.

Live runners now require an explicit test URL, project reference, publishable key,
and matching run-specific fixtures. They reject the shared project, mismatched
origins, and privileged keys before creating clients. Five offline configuration
tests cover those safeguards; the helper suite now has 37 passing tests.
See [live-test setup and cleanup responsibilities](supabase-backend.md#isolated-live-test-configuration).

## Browser automation and formatting follow-up — October 22, 2026

The six formatting findings from the initial baseline are fixed, and frontend
formatting is now a required CI step. `.gitattributes` keeps frontend text at LF
on Windows and Linux. No application behavior changed in those formatting edits.

Five independent Chromium tests now run against the built UI in a separate CI
job. They cover invalid sign-in/session persistence/logout; request submission,
reload, cancellation and slot release; walk-in ID verification and duplicate
pickup stock protection; donation persistence/stock additions; and admin user
creation, report filtering and audit pagination. Tests fail on uncaught page
errors or external-service requests. They use fresh contexts and the sample
calendar date, with no hosted Supabase data or credentials.

Run from `frontend/`:

```sh
npm ci
npx playwright install --no-shell chromium
npm run build
npm run test:e2e
npm run format:check
```

CI uses `playwright install --with-deps --no-shell chromium` on Linux and uploads
the HTML report and failure traces/screenshots for seven days. The separate
container smoke tests still verify FastAPI's production serving boundary.

## Initial baseline

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

1. After UI integration, test the real request/stock contracts and concurrent
   operations through the application, including disabled accounts and denied roles.
2. Test real email confirmation/delivery with authorized test inboxes and configured
   SMTP; resolve and test campus SSO if it becomes a requirement.

The initial baseline predates the browser automation described above. Neither
the initial baseline nor that browser-only stage claimed hosted-backend coverage;
the hosted follow-up at the top records the separate live run.
