from __future__ import annotations

from fastapi import FastAPI
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.internal.jobs import router as internal_jobs_router
from app.api.v1.aircraft import router as aircraft_router
from app.api.v1.auth import router as auth_router
from app.api.v1.auth_email import router as auth_email_router
from app.api.v1.auth_passwords import router as auth_passwords_router
from app.api.v1.benchmark_prices import router as benchmark_prices_router
from app.api.v1.fuel_expenses import router as fuel_expenses_router
from app.api.v1.fx_rates import router as fx_rates_router
from app.api.v1.invoices import router as invoices_router
from app.api.v1.memberships import router as memberships_router
from app.api.v1.pilots import router as pilots_router
from app.api.v1.policy import router as policy_router
from app.core.rate_limit import limiter, rate_limited_handler


app = FastAPI(title="Fuel Books API", version="0.1.0")

# Rate limiter is keyed per-IP by default; individual auth endpoints override
# with a per-email or per-user key. In-memory storage is fine for a single
# process; swap to Redis when we scale out (RATELIMIT_STORAGE_URI).
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limited_handler)
app.add_middleware(SlowAPIMiddleware)

app.include_router(auth_router)
app.include_router(auth_passwords_router)
app.include_router(auth_email_router)
app.include_router(aircraft_router)
app.include_router(pilots_router)
app.include_router(benchmark_prices_router)
app.include_router(fuel_expenses_router)
app.include_router(fx_rates_router)
app.include_router(invoices_router)
app.include_router(memberships_router)
app.include_router(policy_router)
app.include_router(internal_jobs_router)


@app.get("/")
def root() -> dict[str, str]:
    """Public URL probes (e.g. Railway) often hit `/` and expect 200 — not a 404."""
    return {"service": "fuel-books-api", "health": "/health", "docs": "/docs"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

