"""Simplify benchmark prices: drop effective_to, keep includes_vat, default vat_rate=0.20.

Revision ID: 20260506_0003
Revises: 20260506_0002
Create Date: 2026-05-06
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260506_0003"
down_revision = "20260506_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SQLite: rebuild table to drop column / change constraints.
    conn = op.get_bind()

    op.create_table(
        "fuel_benchmark_prices__new",
        sa.Column("id", sa.Integer(), primary_key=True),
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
        sa.UniqueConstraint("airfield_code", "effective_from", "includes_vat", name="uq_benchmark_effective_vat"),
    )
    op.create_index(
        "ix_fuel_benchmark_prices_airfield_code__new",
        "fuel_benchmark_prices__new",
        ["airfield_code"],
        unique=False,
    )

    # Copy: set vat_rate=0.2 when missing
    conn.execute(
        sa.text(
            """
            INSERT INTO fuel_benchmark_prices__new
              (id, airfield_code, effective_from, fuel_type, price_per_unit, unit, currency, includes_vat, vat_rate, created_at, updated_at)
            SELECT
              id, airfield_code, effective_from, fuel_type, price_per_unit, unit, currency, includes_vat,
              COALESCE(vat_rate, 0.2) AS vat_rate,
              created_at, updated_at
            FROM fuel_benchmark_prices
            """
        )
    )

    op.drop_index("ix_fuel_benchmark_prices_airfield_code", table_name="fuel_benchmark_prices")
    op.drop_table("fuel_benchmark_prices")

    op.rename_table("fuel_benchmark_prices__new", "fuel_benchmark_prices")
    # SQLite doesn't support ALTER INDEX ... RENAME across all versions.
    # Drop the temp index name and recreate the canonical one.
    op.drop_index("ix_fuel_benchmark_prices_airfield_code__new", table_name="fuel_benchmark_prices")
    op.create_index(
        "ix_fuel_benchmark_prices_airfield_code",
        "fuel_benchmark_prices",
        ["airfield_code"],
        unique=False,
    )


def downgrade() -> None:
    # Non-trivial (would need to re-add effective_to). Skip for now.
    raise RuntimeError("Downgrade not supported for 20260506_0003")

