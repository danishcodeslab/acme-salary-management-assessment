# ACME Salary Management

A web app that lets ACME's HR Manager manage salaries for **10,000 employees across 12 countries**, replacing the
Excel files, and answer **"how does the org pay people?"** in a couple of clicks.

> **Live demo:** _add Render URL here_ · **Video walkthrough:** _add link here_

| Employees | Insights |
|---|---|
| Server-side paging, search, filters, sorting by local or USD salary, CSV export, create/edit/delete, salary history | Median salary, payroll, by-country stats in local currency and USD, pay by job title per country, department payroll, salary distribution |

## Documents

- [Requirements (one page)](docs/REQUIREMENTS.md): goal, scope, what's deliberately left out and why
- [Architecture](docs/ARCHITECTURE.md): diagrams, layers, data model
- [Design decisions & trade-offs](docs/DECISIONS.md)
- [Performance](docs/PERFORMANCE.md): measured latencies, scaling notes
- [How AI was used](docs/AI_USAGE.md): workflow, prompts, and where the AI was wrong

## Tech stack

- **Backend:** Python 3.12+, FastAPI, SQLAlchemy 2, Alembic, SQLite, pytest, ruff
- **Frontend:** React 18, TypeScript, Vite, MUI + MUI X (DataGrid, Charts), TanStack Query, react-hook-form + zod,
  Vitest + Testing Library + MSW
- **Delivery:** Docker (single service), Render, GitHub Actions

## Run locally

Prerequisites: Python 3.12+ and Node 18+.

```bash
# Backend: http://localhost:8000 (API docs at /docs)
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
alembic upgrade head
python -m scripts.seed            # 10,000 employees (~0.2 s); --reset to re-seed
uvicorn app.main:app --reload

# Frontend: http://localhost:5173 (proxies /api to :8000)
cd frontend
npm install
npm run dev
```

Or run everything as production does:

```bash
docker build -t acme-salary .
docker run -p 8000:8000 acme-salary    # migrates, seeds if empty, serves UI + API on :8000
```

## Tests and checks

```bash
cd backend  && pytest && ruff check . && ruff format --check .      # 95 tests, < 1 s
cd frontend && npm test && npm run typecheck && npm run format:check  # 31 tests
```

**Backend tests cover:**
- CRUD and validation (422/404/409)
- Search, filter, sort and pagination
- Salary history and the currency-change rule
- Insight math: min/max/avg, odd and even medians, USD normalization, band edges, and a cross-check against
  `statistics.median`
- CSV export, including formula-injection sanitizing
- Seed determinism and uniqueness
- Migrations matching the models

**Frontend tests cover:**
- API client error handling
- Form validation and PATCH payload building
- Directory search, URL state, and create/edit flows
- Insights tiles, drilldown and filter

## Deploy (Render)

The repo includes [`render.yaml`](render.yaml). In Render, choose **New → Blueprint** and select this repo. It builds
the Dockerfile and health-checks `/api/health`. On the free plan the filesystem is ephemeral, so the database is
re-seeded on each boot. Attach a disk at `/data`, or set `DATABASE_URL` to Postgres, to keep edits.

## Project layout

```
backend/
  app/            api/ (routers) · services/ · repositories/ · models.py · schemas.py
  alembic/        migrations
  scripts/        seed.py + name lists
  tests/
frontend/src/
  api/            typed client + types
  hooks/          TanStack Query hooks, URL state
  pages/          EmployeesPage, InsightsPage (+ tests)
  components/     dialogs, drawer, filters, insights/ charts
docs/             requirements, architecture, decisions, performance, AI usage
```
