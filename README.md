# Fuel Books (monorepo)

This repo contains:

- `backend/`: FastAPI API + Alembic migrations
- `frontend/`: Next.js (App Router) minimal production UI (BFF proxy + httpOnly auth cookie)

## Local development

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -U pip
pip install -e ".[dev]"

export DATABASE_URL="sqlite:///./dev.db"
export JWT_SECRET="dev-secret-change-me"
uvicorn app.main:app --reload
```

API docs: `http://127.0.0.1:8000/docs`

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Frontend: `http://localhost:3000`

## Environment variables

### Frontend (`frontend/.env.local`)

- `FASTAPI_BASE_URL`: Base URL for the FastAPI service (local: `http://127.0.0.1:8000`)

### Backend (`backend/`)

See `backend/README.md` for the full list. The key ones:

- `DATABASE_URL`
- `JWT_SECRET`
- `INTERNAL_JOB_TOKEN` (only needed if triggering internal jobs)

## Railway deployment

Deploy as **two Railway services** from the **same GitHub repo**. The **backend** uses a **`Dockerfile`** plus **`backend/railway.toml`** (migrations + start command). Frontends still use **`Procfile`** / Nixpacks.

### 1. Create the Railway project

1. In [Railway](https://railway.app), **New project** → **Deploy from GitHub** → select this repo.
2. Add **PostgreSQL**: **New** → **Database** → **PostgreSQL**.

### 2. Backend service (API)

1. **New** → **GitHub Repo** → same repo (or duplicate service from repo).
2. Set **Root directory** to `backend`.
3. In **Variables**, add **`DATABASE_URL`** and choose **Reference variable** → your Postgres plugin’s `DATABASE_URL` (Railway injects `postgres://…`; the app rewrites it for SQLAlchemy + psycopg).
4. Set **`JWT_SECRET`** to a long random string (not the dev default).
5. Set **`FRONTEND_BASE_URL`** to your **frontend’s public URL** once it exists (needed for password reset / verify-email links). Example: `https://your-app.up.railway.app`.
6. Copy other values from `backend/.env.example` as needed (`EMAIL_PROVIDER`, `RESEND_API_KEY`, etc.).

**Build**: `backend/Dockerfile` copies the full tree then runs **`pip install .`** (fixes Nixpacks `pip install -r requirements.txt` failing when the package layout isn’t present yet).

**Deploy**: `backend/railway.toml` sets **`preDeployCommand`** (`alembic upgrade head`). **`Dockerfile`** **`CMD`** starts uvicorn with `sh -c` so **`${PORT}`** is expanded (Railway’s **startCommand** does not run through a shell, so **`$PORT`** would be passed literally). Ensure the service **Root directory** is exactly **`backend`** so `README.md`, `app/`, and `pyproject.toml` are all in the build context.

**Dependencies**: `psycopg[binary]` is in `pyproject.toml`. Optional **`requirements.txt`** (`.`) is for non-Docker pip installs.

### 3. Frontend service (Next.js)

1. **New** → **GitHub Repo** → same repo.
2. Set **Root directory** to `frontend`.
3. **`FASTAPI_BASE_URL`**: your **backend** service **public URL** (HTTPS), e.g. `https://your-api.up.railway.app` — no trailing slash.

**Procfile** (in `frontend/`): `web: npm run start` (listens on **`0.0.0.0`**; Railway sets **`PORT`**).

Nixpacks will run `npm install` / `npm run build` automatically when it detects Node.

### 4. After deploy

1. Open the **backend** URL `/docs` to confirm the API is up.
2. Open the **frontend** URL and register / log in (migrations run via **`preDeployCommand`** before each deploy).
3. Optional: attach **custom domains** to both services and update **`FRONTEND_BASE_URL`** and **`FASTAPI_BASE_URL`** accordingly.

Because the frontend uses Next route handlers as a BFF and stores the access token in an httpOnly cookie, the browser does not need to call FastAPI directly (no CORS dependency).

