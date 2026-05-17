"""Scope benchmark prices to fuel policy.

Revision ID: 20260506_0006
Revises: 20260506_0005
Create Date: 2026-05-06
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260506_0006"
down_revision = "20260506_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # SQLite rebuild: add policy_id + change unique constraint to include policy_id.
    # PostgreSQL: drop UNIQUE first — same constraint name on __new conflicts while old table exists.
    if conn.dialect.name == "postgresql":
        op.drop_constraint("uq_benchmark_effective_vat", "fuel_benchmark_prices", type_="unique")

    op.create_table(
        "fuel_benchmark_prices__new",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("policy_id", sa.Integer(), sa.ForeignKey("fuel_policies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("airfield_code", sa.String(length=8), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("fuel_type", sa.String(length=32), nullable=False),
        sa.Column("price_per_unit", sa.Numeric(12, 6), nullable=False),
        sa.Column("unit", sa.String(length=3), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("includes_vat", sa.Boolean(), nullable=False),
        sa.Column("vat_rate", sa.Numeric(10, 6), nullable=False, server_default=sa.text("0.2")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("policy_id", "airfield_code", "effective_from", "includes_vat", name="uq_benchmark_effective_vat"),
    )
    op.create_index(
        "ix_fuel_benchmark_prices_airfield_code__new",
        "fuel_benchmark_prices__new",
        ["airfield_code"],
        unique=False,
    )
    op.create_index(
        "ix_fuel_benchmark_prices_policy_id__new",
        "fuel_benchmark_prices__new",
        ["policy_id"],
        unique=False,
    )

    # Backfill: attach all existing benchmark prices to policy_id=1
    conn.execute(
        sa.text(
            """
            INSERT INTO fuel_benchmark_prices__new
              (id, policy_id, airfield_code, effective_from, fuel_type, price_per_unit, unit, currency, includes_vat, vat_rate, created_at, updated_at)
            SELECT
              id, 1 as policy_id, airfield_code, effective_from, fuel_type, price_per_unit, unit, currency, includes_vat,
              COALESCE(vat_rate, 0.2) as vat_rate, created_at, updated_at
            FROM fuel_benchmark_prices
            """
        )
    )

    op.drop_index("ix_fuel_benchmark_prices_airfield_code", table_name="fuel_benchmark_prices")
    op.drop_table("fuel_benchmark_prices")

    op.rename_table("fuel_benchmark_prices__new", "fuel_benchmark_prices")
    op.drop_index("ix_fuel_benchmark_prices_airfield_code__new", table_name="fuel_benchmark_prices")
    op.create_index("ix_fuel_benchmark_prices_airfield_code", "fuel_benchmark_prices", ["airfield_code"], unique=False)
    op.drop_index("ix_fuel_benchmark_prices_policy_id__new", table_name="fuel_benchmark_prices")
    op.create_index("ix_fuel_benchmark_prices_policy_id", "fuel_benchmark_prices", ["policy_id"], unique=False)


def downgrade() -> None:
    raise RuntimeError("Downgrade not supported for 20260506_0006")

