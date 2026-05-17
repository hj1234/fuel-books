# Fuel Books API

FastAPI backend for Fuel Books.

## Requirements
- Python 3.11+

## Setup (local)

Create a virtualenv, then install dependencies:

```bash
pip install -e ".[dev]"
```

## Run

```bash
export DATABASE_URL="sqlite:///./dev.db"
export JWT_SECRET="dev-secret-change-me"
uvicorn app.main:app --reload
```

Open docs at `http://127.0.0.1:8000/docs`.

## Database migrations

```bash
alembic upgrade head
```

## Seed demo data (dev only)

This inserts a demo admin user, aircraft, pilots, policy, benchmark prices.

```bash
export SEED_DEMO_DATA=true
export SEED_ADMIN_PASSWORD="password1"
alembic upgrade head
```

## Internal jobs

FX sync is intended to be triggered by a scheduler.

- `POST /internal/jobs/fx-sync`
- `POST /internal/jobs/fx-backfill`

Protect with `X-Internal-Job-Token` matching `INTERNAL_JOB_TOKEN`.

## Auth notes (Swagger)

Swagger's **Authorize** dialog uses OAuth2 password-flow (form-encoded).
Use:
- `POST /v1/auth/login` for form-encoded OAuth2 (Swagger)
- `POST /v1/auth/login-json` for JSON login (curl/clients)

If you see an error about multipart/form parsing, install:

```bash
pip install python-multipart
```

# Fuel Books API

A clean, well-documented Python API for invoicing aircraft syndicate members for fuel usage.

## Goals

- **Clear domain model**: aircraft, members, fuel purchases, allocations, invoices
- **Great DX**: type-safe settings, `/docs` OpenAPI UI, predictable project structure
- **Production-shaped**: async-ready FastAPI app, migrations, tests, config via env vars

## Tech stack

- **FastAPI** (web framework + OpenAPI)
- **SQLModel / SQLAlchemy** (ORM + Pydantic models)
- **Alembic** (migrations)

## Quickstart

### 1) Create a virtualenv + install

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -U pip
pip install -e ".[dev]"
```

If `pip` fails with `CERTIFICATE_VERIFY_FAILED` on macOS, you can install once with trusted hosts:

```bash
pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org -e ".[dev]"
```

### 2) Configure env

```bash
cp .env.example .env
```

Default uses SQLite: `DATABASE_URL=sqlite:///./dev.db`

### 3) Create tables (dev mode)

For early development, you can use the built-in table creation on startup:

```bash
ENV=dev uvicorn fuelbooks_api.main:app --reload
```

Then open:

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

### 4) Migrations (recommended once schema stabilizes)

```bash
alembic revision --autogenerate -m "initial"
alembic upgrade head
```

## Project layout

```
src/fuelbooks_api/
  main.py                # FastAPI app entrypoint
  settings.py            # typed env config
  db.py                  # engine + session helpers
  models.py              # SQLModel tables
  api/
    v1/
      router.py          # versioned API router
      routes/
        health.py        # /api/v1/health
        syndicates.py    # syndicates, aircraft, members
        fuel.py          # fuel purchases + allocations
        invoices.py      # invoice generation + listing
tests/
```

## Domain notes (current)

- **Syndicate**: a group of owners
- **Aircraft**: belongs to a syndicate
- **Member**: belongs to a syndicate
- **FuelPurchase**: a dated purchase for an aircraft (qty + total cost)
- **FuelAllocation**: associates part/all of a purchase to a member (qty allocated)
- **Invoice**: computed from allocations for a time window (initially “draft”)

This repo starts with minimal endpoints and a schema you can extend.

## Environment variables

See `.env.example`. The key variables are:

- `DATABASE_URL` (e.g. `sqlite:///./dev.db` or `postgresql+psycopg://...`)
- `ENV` (`dev` enables auto-create tables on startup)
- `API_TITLE`, `API_VERSION`

## Testing

```bash
pytest
```

## Next steps

- Add auth (API keys per syndicate or user accounts + JWT)
- Add money handling (store currency + decimal amounts; avoid float)
- Add invoice finalization + export (PDF/CSV)
- Add auditing (who changed what and when)
