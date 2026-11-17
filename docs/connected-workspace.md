# Connected pantry workspace

The default frontend now uses Supabase Auth and the pantry API. It does not seed
browser records or accept sample passwords. The original visual walkthrough is
still available by explicitly setting `VITE_PANTRY_MODE=demo` before building.
Its localStorage records never become backend records.

## Functional contracts

- Students register with a university email, confirm it, sign in, restore their
  session after refresh, edit their name, change/reset their password, reserve a
  future pickup slot for available food categories, cancel, and read their own
  request history. A physical student ID is assigned only by staff.
- Staff manage catalog items, receive multi-item donations, adjust stock with a
  reason, read lot/stock history, create/close pickup slots, verify student IDs,
  approve/decline requests, record no-shows, start walk-ins for registered students,
  and complete pickups. A no-show is a declined request with the note `No-show`.
- Admins have staff operations plus private staff invitations, role/access changes,
  last-admin protection, operational/access/identity audit, and date-filtered
  donation/distribution reports.

Requests remain category-based, matching the existing backend. Staff select the
actual items at handout. Slots reserve pickup capacity, not food stock. Stock is
allocated atomically from eligible lots in expiry order when a pickup completes.
The transaction rejects short stock without partially deducting any item.
Completion, reservation, walk-in, and donation IDs support retries without duplicate
writes. Completed/cancelled/declined requests no longer consume slot capacity.
Only one open request per student is accepted through the server operations.

The connected workspace uses its own forms and navigation; the original demo
screens remain unchanged. Business calls live behind `src/lib/pantryApi.js`.
The UI reloads authorized records after writes, on window focus, and every 30
seconds. It shows backend errors and never substitutes mock data on failure.
Authorization, capacity, stock, and status transitions are enforced in PostgreSQL.
Supabase's SDK manages sessions; no service-role credential enters the frontend.

## Existing hosted pantry upgrade

Target: `pvidoddlywstnowhcfyl`. The agent's currently connected Supabase account
does not have this project. No hosted upgrade or production deployment has been
performed by this change. Connect the owning Supabase account before proceeding.

1. Inspect the existing schema, logs, advisors, and applied source versions. Back up
   the database. Do **not** reapply `schema.sql` or `inventory.sql` to the existing
   project. Confirm that `pickup_slots`, `donations`, `pickup_lines`, and the new
   functions do not already exist under a different implementation.
2. Apply `supabase/workflows.sql` once, transactionally. It adds operational tables
   and RPCs and revokes the old direct request insert grant. Existing requests are
   preserved with nullable slot IDs; they can still be decided and completed.
   Old clients submitting requests directly must be upgraded with this release.
3. Deploy `provision-staff` with gateway JWT verification disabled as in
   `supabase/config.toml`. The function independently checks the caller using Auth
   and `my_access`; disabling the gateway check does not disable authorization.
   Set `PANTRY_ALLOWED_ORIGINS` to a comma-separated list of exact deployed frontend
   origins. Never use `*`. Staff invitations are private links, not sent emails.
4. Configure Auth Site URL and allowed redirect URLs to the frontend's actual
   origin. Keep email confirmation enabled and verify production SMTP/inbox
   delivery separately. Local inbox evidence is not production delivery evidence.
5. Copy `frontend/.env.example` to the deployment's build environment. Set
   `VITE_PANTRY_MODE=live`, the project URL, and its publishable key. Build and deploy
   React together with the SQL upgrade; smoke-test each role with authorized test
   records. The FastAPI container continues to host React and health endpoints;
   it is not a second business API.

Docker accepts the public configuration at build time:

```sh
docker build --build-arg VITE_SUPABASE_URL=https://pvidoddlywstnowhcfyl.supabase.co \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY -t pantry:connected .
```

## Repeatable isolated tests

Prerequisites: Docker, Node 22+, npm dependencies in `frontend`, and a Playwright
Chromium installation. CLI version is pinned to 3.2.0. No hosted credentials are
needed. These commands use the local `panther-food-pantry` CLI stack only:

```sh
npx --yes supabase@3.2.0 start -x realtime,storage-api,imgproxy,postgres-meta,studio,logflare,vector,supavisor
node scripts/install-local-database.mjs
npx --yes supabase@3.2.0 functions serve provision-staff --env-file supabase/functions/.env.example
# In a second terminal:
cd frontend
npm ci
npx playwright install --with-deps --no-shell chromium
npm run test:connected
```

The installer refuses to overwrite an existing local pantry schema. For a fresh
rerun, explicitly stop this disposable stack with `supabase stop --no-backup`,
then start/install it again. Do not use that reset on a local stack containing
records you want to retain. The test runner cleans only its generated fixture
UUIDs and signs out/deletes its temporary Auth users. It derives local keys from
CLI status in memory, refuses any API URL except `http://127.0.0.1:54321`, writes
only public values to ignored `frontend/.env.local`, and removes its temporary
browser fixture file. Browser traces can contain disposable credentials and must
remain ignored; the CI connected job does not upload them.

On Windows, `PANTRY_BROWSER_CHANNEL=chrome` selects installed Chrome. The runner
builds the connected bundle itself. Run `node scripts/test-database.mjs` separately
for test-only Auth/SQL policy, rollback, RLS/grant, and concurrency checks.

The CI `connected` job runs the real local Auth/REST/function/email/browser suite.
The `browser` job explicitly builds demo mode and keeps the prior walkthrough
coverage. The frontend logic/build, SQL, Python, and production-container smoke
checks remain separate. No CI job changes the hosted pantry.

## Verification recorded November 17, 2026

- 53 frontend logic tests; formatting; connected production build.
- Real local signup confirmation email and link; password reset email/link/change;
  wrong-password rejection; staff invitation acceptance and login; CORS and
  untrusted-origin rejection.
- API privacy/role denial, direct-write denial, last-admin protection, immediate
  disabled-account enforcement, slot contention, duplicate open request denial,
  cancellation/release, donation rollback/retry, ID checks, short-stock rollback,
  duplicate pickup completion, competing final-unit pickups, walk-ins/no-shows,
  report/stock/audit agreement, and exact fixture cleanup.
- Separate staff/student browser sessions perform donation → request → approval →
  physical-ID verification → pickup → stock/history/report checks → logout.
  The student browser uses a 390×844 viewport. Another browser test rejects a
  wrong workspace and verifies network failure cannot report a successful write.
- SQL access, inventory, workflow, concurrency, RLS, and function-grant checks.
- Four Python tests and Ruff checks; local Supabase security advisors: no issues.
- Four connected browser tests cover the operational journey, signup/recovery,
  staff invitation acceptance, and wrong-workspace/network errors. All eight
  original demo browser tests also pass. Production Docker build and health,
  static asset, OpenAPI, and 404 smoke checks pass.

`npm audit` reports four high-severity entries in the existing Vite development
dependency chain rooted in the picomatch ReDoS advisory GHSA-fc5q-39xc-vjpf.
The installed/published picomatch version is 4.0.7; npm's suggested remediation
would downgrade Vite to 6.2.7. That unrelated downgrade was not applied. This is
a remaining development-tool dependency finding, not a passing security audit.

Pending: hosted project upgrade, real university inbox/SMTP delivery, production
origins and deployment, and teammate review. Campus SSO is not implemented; this
system uses a separate pantry password. This evidence does not establish a full
accessibility audit or a complete device/browser matrix.
