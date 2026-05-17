"""Persist structured refund breakdown snapshot per calculation row.

Revision ID: 20260517_0003
Revises: 20260517_0002
Create Date: 2026-05-17
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260517_0003"
down_revision = "20260517_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "fuel_expense_calculations",
        sa.Column("details_snapshot", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("fuel_expense_calculations", "details_snapshot")
