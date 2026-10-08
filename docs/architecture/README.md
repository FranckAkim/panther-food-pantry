# Architecture

**Decision: Option B — React SPA + FastAPI modular monolith + PostgreSQL, deployed as one Docker container.** It uses every tool the team committed to in Homework 2 (Jira, Figma, VS Code, GitHub Actions, API tests, Docker), gives each of the 8 team members clear ownership, and is finishable by the Nov 19 final presentation.

Diagrams are editable in [draw.io](https://app.diagrams.net) (File → Open from → Device). `Panther_Pantry_Architecture_ALL.drawio` holds all of them as pages.

## Options considered

| Option | Approach | Verdict |
| --- | --- | --- |
| [A](diagrams/01_option_A_django_monolith.png) | Server-rendered Django monolith | **Fallback** if Option B is behind on Oct 29 |
| [B](diagrams/02_option_B_spa_modular_monolith.png) | React SPA + FastAPI modular monolith | **Chosen** |
| [C](diagrams/03_option_C_supabase_baas.png) | Supabase backend-as-a-service | Rejected: one missing Row-Level Security policy exposes a table; vendor lock-in |
| [D](diagrams/04_option_D_aws_serverless.png) | AWS Lambda + API Gateway + EventBridge | Rejected: ~12 services in six weeks; conflicts with a $0 budget |

## Decisions

| # | Question | Decision | Why |
| --- | --- | --- | --- |
| 1 | Stack | Python + FastAPI, React (Vite), PostgreSQL | Widely known; Postgres transactions, row locks and CHECK constraints protect stock |
| 2 | Deployment | One container: API at `/api`, React app at `/` | Same origin → httpOnly cookie, no CORS |
| 3 | Login | Own email + password accounts (argon2), session cookie | Campus SSO needs IT approval we can't get by Nov 19 |
| 4 | Registration | @pvamu.edu email; staff verify student ID once | The app cannot check enrollment itself |
| 5 | No account at the desk | Staff-assisted signup; if that fails, a provisional profile (name + student ID) linked later | Stock stays accurate; nobody is turned away |
| 6 | Requests vs. appointments | One object: every request includes a pickup slot | One status field, fewer screens |
| 7 | Inventory | Items (catalog) + lots (each delivery: qty, expiry, shelf) | Enables expiry alerts and first-expired-first-out |
| 8 | Notifications | In-app status (MVP), email (should-have), no SMS | Cost and scope |
| 9 | Alerts | Computed when the dashboard loads | No scheduler to run |
| 10 | Process | 1-week sprints in Jira | Six-week window |
| 11 | API tests | Bruno (collections stored in Git) | Postman free plan = one user |
| 12 | Hosting | Free-tier platform + local Docker fallback | Assumed $0 budget |

## The invariant

For every lot, at every moment: `0 ≤ qty_on_hand` and `qty_on_hand = Σ inventory_txns.delta`. Enforced by a row lock (`SELECT … FOR UPDATE`), a CHECK constraint, and one transaction per distribution. A concurrency test proves two simultaneous hand-outs of the last item give one success and one `409 Conflict`.

- [Request lifecycle](diagrams/05_workflow_request_lifecycle.png)
- [Distribution transaction](diagrams/06_workflow_distribution_transaction.png)
- [Data model](diagrams/07_data_model.png)

## Assumptions to confirm with the pantry

One pantry site · a few hundred registered students · tens of visits a day · 1–5 staff online at once · no reason-for-need collected · retention policy to be agreed.
