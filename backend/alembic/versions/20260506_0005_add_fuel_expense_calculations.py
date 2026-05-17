"""Add fuel expense calculations audit table.

Revision ID: 20260506_0005
Revises: 20260506_0004
Create Date: 2026-05-06
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260506_0005"
down_revision = "20260506_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fuel_expense_calculations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "fuel_expense_id",
            sa.Integer(),
            sa.ForeignKey("fuel_expenses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("policy_currency", sa.String(length=3), nullable=False),
        sa.Column("refund_amount", sa.Numeric(14, 4), nullable=False),
        sa.Column("refund_currency", sa.String(length=3), nullable=False),
        sa.Column("derivation", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("explanation", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_index(
        "ix_fuel_expense_calculations_fuel_expense_id",
        "fuel_expense_calculations",
        ["fuel_expense_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_fuel_expense_calculations_fuel_expense_id", table_name="fuel_expense_calculations")
    op.drop_table("fuel_expense_calculations")

