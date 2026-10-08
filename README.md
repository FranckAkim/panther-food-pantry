# Panther Food Pantry Management System

A web application that replaces the university food pantry's paper forms and spreadsheets with one role-based system for **students**, **pantry staff** and **administrators**: assistance requests with pickup slots, inventory by lot and expiry date, donations, distributions and reports.

CINS 5318 Software Engineering · Prairie View A&M University · Fall 2026 · Group project

![Architecture — Option B](docs/architecture/diagrams/02_option_B_spa_modular_monolith.png)

## Architecture in one paragraph

A **React single-page app** and a **FastAPI modular monolith** ship as **one Docker container** over **PostgreSQL**. The API lives under `/api`, the React app under `/`, so they share one origin and use an httpOnly session cookie. Code is split into modules (requests, inventory, distribution, reports) that share one database. The rule the whole design protects: **a lot's `qty_on_hand` is never negative and always equals the sum of its ledger entries.** Full rationale, the three rejected options and all diagrams: [`docs/architecture`](docs/architecture/README.md).

## Run it locally

Requirements: [Docker Desktop](https://www.docker.com/products/docker-desktop/) and Git.

```bash
git clone <this repo>
cd panther-food-pantry
docker compose up
```

| URL | What |
| --- | --- |
| http://localhost:5173 | React app (hot reload) |
| http://localhost:8000/api/health | API health check |
| http://localhost:8000/api/docs | Interactive API documentation |

Without Docker (backend only):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
pytest
uvicorn app.main:app --reload
```

## Repository layout

```
backend/            FastAPI app (Python 3.12)
  app/api/          one router per module
  app/core/         settings
  app/db/           database engine and sessions
  tests/            pytest
frontend/           React + Vite
docs/architecture/  design rationale, decisions, draw.io diagrams
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
