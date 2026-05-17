from __future__ import annotations

from collections.abc import Generator
from sqlite3 import Connection as SQLite3Connection

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)


@event.listens_for(Engine, "connect")
def _set_sqlite_pragma(dbapi_connection: object, _connection_record: object) -> None:
    # SQLite disables foreign-key enforcement by default, which means ON DELETE CASCADE
    # never fires and orphan rows linger after parent deletes. Turn it on for every
    # SQLite connection in the pool. No-op for other backends.
    if isinstance(dbapi_connection, SQLite3Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, class_=Session)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

