# System acceptance checklist

Baseline: October 22, 2026, main `e122c1d` after the Vite security update.
Test IDs below are QA identifiers, not Jira issue numbers. This checklist covers
the proposal/UML goals and the [current implementation boundaries](architecture/current-stack.md).

## How to record a result

Record the commit, environment, browser, date, test account role, fixture IDs,
steps, expected result, actual result, evidence location, and related issue.
Use **Pass**, **Fail**, **Blocked**, or **Not run**. Pass applies only to the
tested layer: a mock-browser pass or SQL-policy pass is not connected-system acceptance.
Never include passwords, tokens, private invitation URLs, or real pantry records in evidence.

The coverage column identifies existing automated evidence. The connected status
is a separate assessment and must change only after executing the real journey.

## Requirements and coverage

| ID | Role and acceptance criterion | Existing automated coverage | Connected status |
| --- | --- | --- | --- |
| A01 | Student registers with university email and completes confirmation | Helper validation; separate historical Auth checks | Blocked: I1, I6 |
| A02 | Each role signs in, survives refresh, signs out, and loses protected access | Mock-browser sign-in/refresh/logout; service helper tests | Blocked: I1 |
| A03 | Wrong role, anonymous visitor, and disabled account cannot access protected records | Helper tests; SQL access suite | Blocked: I1 |
| A04 | Student can read only their own profile and requests | SQL access suite | Blocked: I1, I2 |
| A05 | Student sees active, received, unexpired stock with positive quantity | SQL availability checks; mock UI | Blocked: I1, I2 |
| A06 | Student submits valid food selection and reserves one available pickup slot | Mock-browser reservation and persistence | Blocked: I2, I3 |
| A07 | Full or past slot and duplicate open request reject without consuming capacity | Mock logic only; not a complete browser acceptance test | Blocked: I3 |
| A08 | Staff approves/declines; student sees the updated status after refresh | UI controllers exist; real status transition absent | Blocked: I2, I3 |
| A09 | Student cancels their request and capacity returns exactly once | Mock-browser cancellation | Blocked: I2, I3 |
| A10 | Staff records donation items/lots and stock increases by the received quantity | Mock-browser donation; SQL lot creation | Blocked: I2, I4 |
| A11 | Stock shortage, invalid dates/quantity, and unauthorized direct writes reject atomically | SQL inventory suite; domain/helper tests | Blocked: I2, I4 |
| A12 | Staff completes a pickup once, using eligible lots and correct deductions | Mock-browser walk-in and duplicate completion; domain allocation tests | Blocked: I3, I4 |
| A13 | Two staff contend for the final unit; one succeeds and the ledger agrees | Local SQL two-connection concurrency test | Blocked: I3, I4 |
| A14 | Staff verifies a physical ID and duplicates/unauthorized ID edits reject | Mock-browser verification; SQL identity/audit checks | Blocked: I1, I2 |
| A15 | Admin provisions staff, changes roles, disables access, and protects the last admin | Helper/handler tests; SQL access suite; mock-browser user creation | Blocked: I1, I5 |
| A16 | Student history, stock history, reports, and audit agree after a completed journey | Domain/report tests; mock-browser filtering/audit pagination | Blocked: I3, I4, I5 |
| A17 | Real signup email reaches the authorized inbox and its link works | Confirmation state observed historically; inbox delivery unverified | Not run: I6 |
| A18 | Keyboard-only user can complete each core form and recover from validation errors | Some UI semantics exist; no complete manual acceptance record | Not run |
| A19 | Student/staff screens work on narrow mobile and desktop layouts | Existing browser suite uses desktop Chromium | Not run |
| A20 | Network failure, expired session, and denied operation produce an actionable error without duplicate writes | Limited helper coverage; no connected browser journey | Blocked: I1, I2, I3 |

## Integration gates

- **I1 — Sessions and identity:** replace mock login/controllers with live service
  adapters, confirmation/session bootstrap, backend UUID mapping, and role checks.
- **I2 — Data contracts:** agree the UI item/slot model versus backend category
  requests, server-owned identity, field names, dates, and statuses.
- **I3 — Requests and pickups:** implement server-enforced slot capacity,
  approval/decline/cancellation, and an atomic pickup completion contract.
- **I4 — Donations and stock:** connect donation records, lots, multi-item stock
  changes, and duplicate-completion protection through authorized backend operations.
- **I5 — Administration and reporting:** connect user management, private invitations,
  actual browser-origin configuration, operational audit, and report aggregation.
- **I6 — Email:** use an authorized isolated test environment/inbox and verify delivery,
  link expiry/confirmation, and login. Account confirmation alone is not inbox evidence.

Agree these contracts with the feature implementers before changing the acceptance
criteria. Campus SSO is an open requirement, not an implemented sign-in mechanism.

## First connected journey after the gates are ready

Use isolated test accounts and stock, not the shared production pantry. Record
all fixture IDs and starting totals. Use separate role sessions.

1. Staff records a donation of 2 units in a dated lot. Quantity and ledger increase by 2.
2. Student sees the available category/item, requests 1 unit, and chooses a slot.
3. Staff approves it. Student refreshes and sees the same request and confirmed slot.
4. Staff completes the pickup. Exactly 1 unit leaves eligible stock.
5. Staff retries completion, including a stale page. Stock and history do not change.
6. Student history, staff stock history, and the selected-period report agree.
7. Sign out, sign in again, and verify persistence from a different browser session.
8. Clean up only fixtures belonging to this run and record cleanup evidence.

Then run cancellation/capacity release, insufficient-stock, concurrent-final-unit,
disabled-session, cross-student privacy, and interruption variants. If a target
contract differs from this proposed journey, resolve that difference before execution.

## Repeatable baseline

- Frontend logic, formatting, and bundle: `npm test`, `npm run format:check`,
  and `npm run build` in `frontend/` with Node 22.
- Browser demo: `npm run test:e2e` after installing the configured Chromium.
- Database contracts: `node scripts/test-database.mjs` from the repo root.
  Docker and Node 22 are required. It creates/removes a network-isolated database.
- Full commands, evidence scope, and historical runs: [testing guide](testing.md).

The SQL runner supplies an Auth stand-in. Passing it does not verify real tokens,
Auth sessions, PostgREST, deployed Edge Functions, browser CORS, or email delivery.
