"""Rate-limit primitives shared by the auth endpoints.

We use slowapi (built on `limits`) with an in-memory backend. That is fine for
a single-process deployment; once we run multiple workers/instances, switch the
storage to Redis (set `RATELIMIT_STORAGE_URI` and let slowapi pick it up).

Key strategy: we combine a per-IP key with a per-account key on the same
endpoint so a noisy network can't lock out a real account, but a single
attacker also can't grind one address. Each route gets two decorators.

slowapi's evaluator is fully synchronous and never awaits key_funcs, so we
read the request body via the bytes Starlette already buffered during
dependency resolution (FastAPI parses the body before our wrapper runs).
"""

from __future__ import annotations

import json
from urllib.parse import parse_qsl

from fastapi import Request
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.responses import JSONResponse


limiter = Limiter(key_func=get_remote_address)


def rate_limited_handler(_request: Request, _exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Try again shortly."},
    )


def email_key_from_json(request: Request) -> str:
    """Key by the email-shaped field in a JSON body, falling back to client IP."""
    body = _peek_body(request)
    if isinstance(body, dict):
        for field in ("email", "new_email", "username"):
            value = body.get(field)
            if isinstance(value, str) and value:
                return f"email:{value.strip().lower()}"
    return f"ip:{get_remote_address(request)}"


def email_key_from_form(request: Request) -> str:
    """Key by `username` in a form-urlencoded body (OAuth2 password flow)."""
    body = _peek_body(request)
    if isinstance(body, dict):
        username = body.get("username")
        if isinstance(username, str) and username:
            return f"email:{username.strip().lower()}"
    return f"ip:{get_remote_address(request)}"


def user_id_key(request: Request) -> str:
    """Key by the authenticated user id when available, otherwise IP."""
    user = getattr(request.state, "current_user", None)
    if user is not None and getattr(user, "id", None) is not None:
        return f"user:{user.id}"
    return f"ip:{get_remote_address(request)}"


def _peek_body(request: Request) -> dict | None:
    """Best-effort sync read of the already-buffered request body.

    FastAPI parses the body (and so calls `await request.body()`) before our
    wrapper runs, which means `request._body` is already populated. We can
    therefore parse it synchronously without re-awaiting the stream.

    Returns None if the body isn't buffered, can't be parsed, or isn't a dict
    we recognise. The keyfunc then falls back to the client IP.
    """
    cached: dict | None = getattr(request.state, "_rl_body_cache", None)
    if cached is not None:
        return cached

    raw: bytes | None = getattr(request, "_body", None)
    if raw is None or not raw:
        return None

    content_type = (request.headers.get("content-type") or "").lower()
    parsed: dict | None = None
    try:
        if "application/json" in content_type:
            decoded = json.loads(raw)
            if isinstance(decoded, dict):
                parsed = decoded
        elif "application/x-www-form-urlencoded" in content_type:
            parsed = {k: v for k, v in parse_qsl(raw.decode("utf-8"))}
    except Exception:
        parsed = None

    if isinstance(parsed, dict):
        request.state._rl_body_cache = parsed
    return parsed
