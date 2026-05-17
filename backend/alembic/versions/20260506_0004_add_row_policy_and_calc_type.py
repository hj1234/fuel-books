"""Add ROW country override and new calc type.

Revision ID: 20260506_0004
Revises: 20260506_0003
Create Date: 2026-05-06
"""

from __future__ import annotations

from datetime import date

import sqlalchemy as sa
from alembic import op


revision = "20260506_0004"
down_revision = "20260506_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Expand country_code to allow 'ROW' and insert the ROW policy row for aircraft 1 (policy_id=1).
    # SQLite doesn't support ALTER COLUMN, so rebuild the table.
    # PostgreSQL: drop UNIQUE first — constraint names are schema-wide (same name on __new conflicts).
    if conn.dialect.name == "postgresql":
        op.drop_constraint("uq_policy_country_effective_from", "fuel_policy_country_rates", type_="unique")

    op.create_table(
        "fuel_policy_country_rates__new",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("policy_id", sa.Integer(), sa.ForeignKey("fuel_policies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("country_code", sa.String(length=3), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("calc_type", sa.String(length=64), nullable=False),
        sa.Column("percent_rate", sa.Numeric(10, 6), nullable=True),
        sa.Column("benchmark_airfield_code", sa.String(length=8), nullable=True),
        sa.Column("benchmark_multiplier", sa.Numeric(10, 6), nullable=True),
        sa.Column("reimburse_vat", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.UniqueConstraint("policy_id", "country_code", "effective_from", name="uq_policy_country_effective_from"),
    )

    conn.execute(
        sa.text(
            """
            INSERT INTO fuel_policy_country_rates__new
              (id, policy_id, country_code, effective_from, effective_to, calc_type,
               percent_rate, benchmark_airfield_code, benchmark_multiplier, reimburse_vat)
            SELECT
              id, policy_id, country_code, effective_from, effective_to, calc_type,
              percent_rate, benchmark_airfield_code, benchmark_multiplier, reimburse_vat
            FROM fuel_policy_country_rates
            """
        )
    )

    op.drop_table("fuel_policy_country_rates")
    op.rename_table("fuel_policy_country_rates__new", "fuel_policy_country_rates")

    # Insert ROW rule for current aircraft/policy (policy_id=1).
    conn.execute(
        sa.text(
            """
            INSERT INTO fuel_policy_country_rates
              (policy_id, country_code, effective_from, effective_to, calc_type,
               percent_rate, benchmark_airfield_code, benchmark_multiplier, reimburse_vat)
            VALUES
              (1, 'ROW', :effective_from, NULL, 'ACTUALS_CAPPED_TO_BENCHMARK_EX_VAT',
               NULL, 'EGHO', 1.10, false)
            ON CONFLICT(policy_id, country_code, effective_from) DO NOTHING
            """
        ),
        {"effective_from": date(2025, 1, 1)},
    )


def downgrade() -> None:
    raise RuntimeError("Downgrade not supported for 20260506_0004")

