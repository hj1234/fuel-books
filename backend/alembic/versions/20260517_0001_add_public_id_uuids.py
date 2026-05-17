"""Add public_id UUID columns to user-facing tables.

Adds an opaque, URL-safe identifier (`public_id`, UUID4) to each table whose
internal integer primary key is currently exposed in API URLs or response
bodies. The internal `id` column is preserved unchanged so foreign keys,
joins, and migrations continue to work without disruption — only the public
surface (URLs + API responses) switches to UUIDs.

Revision ID: 20260517_0001
Revises: 20260508_0001
Create Date: 2026-05-17
"""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from alembic import op


revision = "20260517_0001"
down_revision = "20260508_0001"
branch_labels = None
depends_on = None


# Tables that need a UUID public_id. Order matters only for readability.
_TABLES: tuple[str, ...] = (
    "aircraft",
    "pilots",
    "fuel_expenses",
    "fuel_benchmark_prices",
    "aircraft_memberships",
    "fuel_policies",
)


def _backfill(table: str) -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.text(f"SELECT id FROM {table} WHERE public_id IS NULL")).fetchall()
    for (row_id,) in rows:
        conn.execute(
            sa.text(f"UPDATE {table} SET public_id = :pid WHERE id = :id"),
            {"pid": str(uuid.uuid4()), "id": row_id},
        )


def upgrade() -> None:
    for table in _TABLES:
        # 1) Add the column as nullable so existing rows are valid mid-migration.
        with op.batch_alter_table(table) as batch_op:
            batch_op.add_column(sa.Column("public_id", sa.String(length=36), nullable=True))

        # 2) Backfill existing rows with fresh UUIDs.
        _backfill(table)

        # 3) Lock down: NOT NULL + UNIQUE index for fast lookups by public_id.
        with op.batch_alter_table(table) as batch_op:
            batch_op.alter_column("public_id", existing_type=sa.String(length=36), nullable=False)
            batch_op.create_index(
                f"ix_{table}_public_id", ["public_id"], unique=True
            )


def downgrade() -> None:
    for table in _TABLES:
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_index(f"ix_{table}_public_id")
            batch_op.drop_column("public_id")
