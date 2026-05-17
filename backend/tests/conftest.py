"""Shared pytest fixtures for the Fuel Books backend.

The login-management tests need an isolated SQLite database (so they don't
clobber the dev DB), with the schema created by SQLAlchemy directly. We also
disable the slowapi rate limiter so tests don't trip over the 5/min IP cap
when they hammer the login endpoint to exercise the lockout flow.
"""

from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


@pytest.fixture(scope="session", autouse=True)
def _set_env(tmp_path_factory: pytest.TempPathFactory) -> Generator[None, None, None]:
    """Point the backend at a throwaway SQLite file before app modules import."""
    db_path: Path = tmp_path_factory.mktemp("db") / "test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["JWT_SECRET"] = "test-secret"
    os.environ["INTERNAL_JOB_TOKEN"] = "test-internal"
    os.environ.setdefault("EMAIL_PROVIDER", "console")
    yield


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    # Import lazily so the env from `_set_env` is honoured.
    from app.db.base import Base
    from app.db.session import engine
    from app.main import app
    from app.models import all as _models  # noqa: F401 - register models

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    # Disable the limiter so brute-force tests can iterate without tripping the
    # per-IP cap. The limiter logic itself is exercised separately.
    app.state.limiter.enabled = False

    with TestClient(app) as c:
        yield c

    app.state.limiter.enabled = True
    app.state.limiter.reset()


@pytest.fixture()
def db_session() -> Generator:
    """A standalone Session that points at the same test engine."""
    from app.db.session import engine

    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def fresh_engine() -> Generator:
    """Helper for tests that need to manipulate the engine directly."""
    from app.db.session import engine

    yield engine


@pytest.fixture()
def make_engine_url(tmp_path: Path) -> str:
    return f"sqlite:///{tmp_path / 'isolated.db'}"


@pytest.fixture()
def isolated_engine(make_engine_url: str) -> Generator:
    """For one-off tests that want a clean DB rather than the session-wide one."""
    engine = create_engine(make_engine_url, connect_args={"check_same_thread": False})
    yield engine
    engine.dispose()
