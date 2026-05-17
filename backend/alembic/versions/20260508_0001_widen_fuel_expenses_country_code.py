"""Widen fuel_expenses.country_code.

Revision ID: 20260508_0001
Revises: 20260506_0012
Create Date: 2026-05-08
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260508_0001"
down_revision = "20260506_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("fuel_expenses") as batch_op:
        batch_op.alter_column(
            "country_code",
            existing_type=sa.String(length=2),
            type_=sa.String(length=64),
            existing_nullable=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("fuel_expenses") as batch_op:
        batch_op.alter_column(
            "country_code",
            existing_type=sa.String(length=64),
            type_=sa.String(length=2),
            existing_nullable=False,
        )

