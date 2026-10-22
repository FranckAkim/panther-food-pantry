# Panther Food Pantry Management System

**Backend update (PFPMS-1–4):** Auth, profiles, role/access management and student
request submission now use Supabase. See [setup and integration instructions](docs/supabase-backend.md).
The FastAPI/Docker architecture below is the original scaffold; the team is moving
to Supabase. Frontend screens still need to connect to the supplied integration helpers.

A web application that replaces the university food pantry's paper forms and spreadsheets with one role-based system for **students**, **pantry staff** and **administrators**: assistance requests with pickup slots, inventory by lot and expiry date, donations, distributions and reports.

CINS 5318 Software Engineering · Prairie View A&M University · Fall 2026 · Group project

## Current technology stack

The merged code contains a **React frontend and Supabase business backend**. The screens still use mock data; connecting their feature hooks to the supplied Supabase service is the next integration step.

| Layer | Implemented technology | Current role |
| --- | --- | --- |
| Frontend | React 18.3.1, JavaScript/JSX, Vite 5, HeroUI, Tailwind CSS 4, Framer Motion, react-hot-toast | Student, staff, and admin screens, hash routing, browser-persisted demo workflows |
| Business backend | Supabase Auth, PostgreSQL, PostgREST, RLS, SQL RPCs | Accounts, roles/access, verified student IDs, category-based requests, inventory, atomic stock adjustments, availability |
| Privileged function | Supabase Edge Function, TypeScript/Deno | Admin-authorized staff provisioning and private invitations |
| Retained server | Python 3.12, FastAPI, Uvicorn, SQLAlchemy 2, psycopg 3 | Health checks, optional database readiness, and built React hosting |
| Tooling | Node.js 22, npm, Prettier, Node test runner, pytest, Ruff, Docker, GitHub Actions | Development, tests, builds, and container smoke checks |

Read [current architecture and integration boundaries](docs/architecture/current-stack.md) and [Supabase setup/API contracts](docs/supabase-backend.md). The [October 8 proposal](docs/architecture/design.md), original diagrams, and presentation describe the historical FastAPI design, including authentication and business modules that were not implemented.

## Project documents

| Document | File |
| --- | --- |
| Project proposal | [docs/course/Project_Proposal.docx](docs/course/Project_Proposal.docx) |
| Homework 2 — SE tools report | [docs/course/Homework2_SE_Tools_Report.pdf](docs/course/Homework2_SE_Tools_Report.pdf) |
| Architecture design | [docs/architecture/design.md](docs/architecture/design.md) |
| Architecture presentation | [docs/presentation/Panther_Food_Pantry_Architecture.pptx](docs/presentation/Panther_Food_Pantry_Architecture.pptx) |
| Editable diagrams (draw.io) | [docs/architecture/diagrams/](docs/architecture/diagrams/) |

## Run it locally

### Frontend demo

Use Node.js 22 and npm:

```bash
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. Sample accounts shown on the sign-in pages belong to the mock UI, not Supabase Auth. Run `npm test` and `npm run build` in `frontend/` to check helpers and the bundle.

### Supabase backend

From `frontend/`, run `node scripts/pantry-terminal.mjs` to sign in, or add `register` to register your own student account. Follow [the backend guide](docs/supabase-backend.md) for email confirmation, admin bootstrap, staff invitations, schema setup, and tests. Use a separate pantry password, not a campus password.

For browser integration, copy `frontend/.env.example` to `frontend/.env`. Its public URL and publishable key configure `src/lib/supabase.js`; environment configuration alone does not switch existing screens to live data. Never put service-role secrets in frontend variables.

### Retained Docker scaffold

Requirements: [Docker Desktop](https://www.docker.com/products/docker-desktop/) and Git. Run from the repository root:

```bash
git clone <this repo>
cd panther-food-pantry
docker compose up
```

| URL | What |
| --- | --- |
| http://localhost:5173 | React app (hot reload) |
| http://localhost:8000/api/health | API health check |
| http://localhost:8000/api/health/db | Scaffold PostgreSQL readiness |
| http://localhost:8000/api/docs | FastAPI health API documentation |

Compose runs a separate PostgreSQL 16 instance for the FastAPI scaffold. It does not start Supabase Auth or apply the Supabase schema. The production Dockerfile serves React through FastAPI; Supabase is deployed separately. CI builds and smoke-tests Docker but does not automatically deploy it.

Without Docker (backend only):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
pytest
uvicorn app.main:app --reload --port 8000
```

## Repository layout

```
backend/            retained FastAPI scaffold (Python 3.12)
  app/api/          health endpoints
  app/core/         settings
  app/db/           database engine and sessions
  tests/            pytest
frontend/           React + Vite, Supabase helpers, terminal tool, Node tests
supabase/           schema, RLS, SQL RPCs/tests, staff-provisioning Edge Function
docs/architecture/  current stack plus historical design and draw.io diagrams
docs/supabase-backend.md  business-backend setup and contracts
Dockerfile          production image (React build + API in one container)
docker-compose.yml  local development stack
.github/workflows/  CI: lint, tests, frontend build, Docker smoke test
```

## Team

| Area | Members |
| --- | --- |
| Project management + requirements | Cecilio, Damario Johnson |
| Frontend (React) | Samuel, Alvi Anowar |
| Backend + database (FastAPI) | Oluwafemi Bamidele, Joshua Gado |
| DevOps + testing | Franck Darole |
| Integration, documentation + presentation | Usman Jibril |

How we work: [CONTRIBUTING.md](CONTRIBUTING.md).
