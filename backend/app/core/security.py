from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def create_access_token(*, subject: str, expires_minutes: int | None = None) -> str:
    expires = timedelta(minutes=expires_minutes or settings.access_token_exp_minutes)
    now = datetime.now(UTC)
    payload: dict[str, Any] = {"sub": subject, "iat": int(now.timestamp()), "exp": int((now + expires).timestamp())}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def hash_token(token: str) -> str:
    """Return the sha256 hex digest used to store/lookup auth tokens.

    Plaintext tokens never touch the database; only their digest does, so a DB
    leak cannot be replayed against the API.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_token(num_bytes: int = 32) -> tuple[str, str]:
    """Return (plaintext, sha256_hex) for a new single-use auth token.

    The plaintext is what we email to the user. The hex is what we persist.
    """
    plaintext = secrets.token_urlsafe(num_bytes)
    return plaintext, hash_token(plaintext)


def as_utc(dt: datetime) -> datetime:
    """Treat naive datetimes (e.g. read back from SQLite) as UTC.

    SQLAlchemy strips tzinfo when persisting to SQLite, so values come back
    naive. Postgres returns them aware. This helper normalises both so we can
    compare against `datetime.now(UTC)` without TypeError.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt

