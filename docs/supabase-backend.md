# Sprint 1 backend: authentication, accounts, inventory and availability

Project: Panther Food Pantry (`pvidoddlywstnowhcfyl`). Schema deployed through the
Supabase migration `pantry_auth_roles_requests`; its source is `supabase/schema.sql`.
The existing FastAPI scaffold is retained for health checks and built UI hosting.
See [current architecture](architecture/current-stack.md) for the boundary between
the mock screens, Supabase business backend, and Docker scaffold.

## Authentication

Initial implementation uses a `pvamu.edu` email plus a **separate pantry password**.
It is not university SSO. Do not enter a campus password in the pantry app.
Campus SSO requires an identity-provider agreement/configuration and remains open.
Supabase email confirmation is required by default. In Authentication → URL
Configuration, set the site URL to your development/deployed frontend URL and allow
the appropriate redirect URLs. Configure SMTP before onboarding the full team:
the default email sender restricts recipients and rate limits sending.

## First administrator and staff accounts

1. Register the designated administrator with their own university email; confirm
   the email. Do not share passwords or create public demo credentials.
2. The project owner uses the SQL Editor to promote that exact verified user ID:
   `update private.user_access set role = 'admin' where user_id = '<verified-user-uuid>';`
   This one-time bootstrap is privileged; ordinary users cannot call it.
3. Admins call `provisionStaff({email, displayName})` to create staff accounts and
   generate private invitation links. No email is sent. Share the link securely
   with its intended staff member; it grants access. Existing student accounts can
   instead be promoted using `setUserAccess`. Public signup always starts as student.
4. Staff can accept an invitation and set their password from the terminal tool.
   The backend does not require frontend screens to verify these operations.

## Frontend integration

Copy `frontend/.env.example` to `frontend/.env`. It contains only a public key.
Never put a secret/service-role key in frontend environment variables.

```js
import { getPantryApi } from './lib/supabase';
const api = getPantryApi();
await api.registerStudent({ email, password, displayName });
await api.signIn({ email, password, workspace: 'student' }); // or staff/admin
const account = await api.currentUser(); // user, profile, role
await api.updateMyProfile({ displayName }); // users can edit only their own name
await api.setStudentId({ userId, studentId, identificationChecked: true }); // staff/admin, after checking physical ID
await api.submitRequest({ categories: ['Produce'], pickupNote: '' });
await api.myRequests();
await api.listUsers(); // admin only
await api.setUserAccess({ userId, role: 'staff', enabled: true }); // admin only
await api.provisionStaff({ email, displayName }); // admin only; private invitation
await api.signOut();
```

Handle returned errors in the UI, especially email confirmation, wrong workspace,
disabled access, and invalid input. RLS enforces access even if UI checks are bypassed.
Role changes take effect on the next database operation without waiting for token
refresh. Disabling application access blocks pantry data; it does not ban the Auth
identity or revoke every Supabase token. The last enabled admin cannot be removed.

## Request contract

Students submit one to ten food categories and an optional pickup logistics note
(maximum 500 characters). Ownership, initial status `submitted`, and timestamp are
server-controlled. Other students cannot view the request. Staff/admin can read it.
Approvals, pickup-slot capacity, and distributions belong to later stories.
Confirm category choices and final fields with the frontend team before release.

## Verification

### Isolated live-test configuration

Live runners have no default URL or API key. They refuse the shared pantry project
and require an explicit project reference that matches the URL. Keep the following
in an ignored local `frontend/.env.test`, using your isolated project's values:

```dotenv
PANTRY_TEST_PROJECT_REF=your_20_character_ref
PANTRY_TEST_URL=https://your_20_character_ref.supabase.co
PANTRY_TEST_PUBLISHABLE_KEY=sb_publishable_your_test_key
PANTRY_TEST_FIXTURES=C:/private/pantry-live-fixtures.json
```

From `frontend/`, using Node 22:

```sh
node --env-file=.env.test tests/auth-smoke.mjs
node --env-file=.env.test tests/live-backend.mjs
```

For a read-only browser transport check, also set
`PANTRY_TEST_APP_ORIGIN=http://127.0.0.1:4173` (or the exact intended frontend
origin) and run:

```sh
node --env-file=.env.test tests/browser-readiness.mjs
```

This checks OPTIONS status, allowed origin, POST, and bearer-client headers for
Auth, the availability RPC, and staff provisioning. It sends no email and changes
no records. It exits nonzero if an endpoint is not browser-ready. The current
staff function is documented for terminal/server use and returns 405 without CORS
headers to preflight; expect this readiness check to flag it until approved browser
origins are configured and preflight/error handling is implemented. This live
check is not part of offline CI and does not prove the React screens are integrated.

The first runner checks invalid credentials and anonymous denial without creating
accounts. The second changes test data: it creates a staff invitation, inventory,
a lot and request; consumes stock; and disables its disposable student account.
Use only an isolated test project and run-specific accounts. It signs out sessions
in `finally`; the project owner must still remove fixture accounts and business
records afterward, including after a failed run. It does not send invitation email.

The private fixture JSON must contain `projectRef`, a unique lowercase `run` marker
(8–64 letters/numbers/hyphens), `admin` and `student` objects with `id`, `email`, and
`password`, plus `staffEmail` and `staffPassword`. All three emails must contain the
run marker and end in `@pvamu.edu`; passwords must be at least 12 characters. The
admin/student accounts must already be confirmed, with their correct application
roles. The staff email must be unused. Never commit this file or its credentials.

### SQL and API checks

Run `supabase/tests/access.sql` in SQL Editor. It creates temporary fixtures inside
a transaction and rolls all changes back. Tests cover metadata role escalation,
own-record access, admin operations, audit records, last-admin protection, staff
access, disabled existing sessions, and anonymous denial. No real user data remains.
Run helper tests with `npm test` from `frontend/`; this also covers UI domain helpers.
Run `supabase/tests/inventory.sql` in SQL Editor for stock/availability policies.

Live backend API tests passed with explicitly authorized temporary accounts:
student/admin password login, admin-created staff invitation, invitation acceptance,
staff password login, inventory create/update, stock history, access denial,
student request submission, disabled existing sessions, and logout. Two concurrent
decrements of the final item produced one success and one rejection, leaving zero
stock and a matching ledger. Test accounts and records were deleted afterward.
`frontend/tests/live-backend.mjs` is the reusable runner; it requires a private
fixture JSON file and separate authorized fixture provisioning/cleanup.

Remaining setup for real users: designate/bootstrap the first admin, configure
email confirmation URLs/SMTP, and resolve whether campus SSO is actually required.
Team-built frontend screens still need integration; they are outside backend work.

## Inventory and landing-page contract

`createItem`/`updateItem`/`listItems` manage the catalog (name, category, unit, active).
`createLot`/`updateLot`/`listLots` manage storage locations and received/expiry dates.
Quantities are integers in the item's declared unit. Only staff/admin can write.
`adjustStock({lotId, delta, reason})` updates quantity and appends a ledger record in
one locked transaction. Direct quantity changes and direct ledger writes are denied.
The sum of ledger changes matches stock; negative stock is rejected.
`stockHistory(lotId)` returns actor, reason, delta, resulting quantity and timestamp.

`availableInventory()` provides active, received, unexpired in-stock items to active
signed-in users, without storage locations or staff history. Anonymous access is
denied by default. `currentUser()` provides role/profile for authenticated landing
pages; public static landing-page text needs no backend. Confirm this access choice
and the final category labels with frontend before release.

## Terminal demonstration (no frontend needed)

From the repository's `frontend` directory, install dependencies with `npm ci`.
Run `node scripts/pantry-terminal.mjs register` to register a student, or
`node scripts/pantry-terminal.mjs` to sign in. Password entry is hidden.
The menu supports adding/editing inventory, lots, stock adjustments, availability,
role/access management, staff invitations, and food requests.
Staff accept their private invitation with
`node scripts/pantry-terminal.mjs accept-invite`, then set a pantry password.
The tool uses a publishable key only and never stores a session or prints session
tokens. Private invitation links are displayed only for the administrator's
explicit create-staff action; share them only with the intended recipient.
Use Node.js 22, matching the frontend CI and Docker build.

The staff invitation function verifies the access token using Auth.getUser and
checks live admin membership before using its server-only service key. It is
currently intended for terminal/server calls. Browser cross-origin access must
be configured for the team's specific frontend origin before connecting that UI.
Gateway JWT
verification is disabled to support modern signing keys; authorization is enforced
inside the function. No service key is exposed to the client. An invite creates an
unconfirmed account; only accepting it activates login. If role assignment fails,
the endpoint reports incomplete provisioning rather than deleting an account.

Cloud schema sources: `supabase/schema.sql`, `request_validation.sql`, and
`inventory.sql`. Apply in that order to a fresh project. The current schema includes
the verified-student-ID fix. To upgrade an existing project created before that fix,
apply `supabase/student_id_verification.sql` once; do not rerun `schema.sql`.
The shared project already has the upgrade deployed.

## Verified student IDs

Students can update only `display_name`; direct `student_id` changes are denied at
the database privilege level. Staff/admin use `staff_set_student_id` only after
checking the physical ID, explicitly acknowledging the check. The database cannot
perform that human verification itself. The operation trims and uppercases the ID,
preserves uniqueness, and records actor, target, previous/new ID, verification
acknowledgement and timestamp in `student_id_audit`, in the same transaction.
Staff/admin can read the log; ordinary clients cannot insert, change or delete it.
There is no automatic linking or merging of pantry history in this operation.
Terminal action 15 provides this workflow. `updateMyProfile` never sends a student ID.

References: https://supabase.com/docs/guides/auth/passwords and
https://supabase.com/docs/guides/database/secure-data.
