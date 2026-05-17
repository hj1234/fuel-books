"""Initial schema.

Revision ID: 20260506_0001
Revises: 
Create Date: 2026-05-06
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260506_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_admin_users_email", "admin_users", ["email"], unique=False)

    op.create_table(
        "aircraft",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("admin_user_id", sa.Integer(), sa.ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("registration", sa.String(length=32), nullable=False),
        sa.Column("make", sa.String(length=80), nullable=False),
        sa.Column("model", sa.String(length=80), nullable=False),
        sa.Column("home_base_airfield", sa.String(length=8), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("admin_user_id", "registration", name="uq_aircraft_owner_registration"),
    )

    op.create_table(
        "pilots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("aircraft_id", sa.Integer(), sa.ForeignKey("aircraft.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )

    op.create_table(
        "fuel_policies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("aircraft_id", sa.Integer(), sa.ForeignKey("aircraft.id", ondelete="CASCADE"), nullable=False),
        sa.Column("base_currency", sa.String(length=3), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("aircraft_id", name="uq_policy_aircraft"),
    )

    op.create_table(
        "fuel_policy_country_rates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("policy_id", sa.Integer(), sa.ForeignKey("fuel_policies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("country_code", sa.String(length=3), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column(
            "calc_type",
            sa.Enum(
                "PERCENT_TOTAL",
                "ACTUALS_CAPPED_TO_BENCHMARK",
                "ACTUALS_CAPPED_TO_BENCHMARK_EX_VAT",
                "BENCHMARK_EX_VAT",
                name="countrycalctype",
            ),
            nullable=False,
        ),
        sa.Column("percent_rate", sa.Numeric(10, 6), nullable=True),
        sa.Column("benchmark_airfield_code", sa.String(length=8), nullable=True),
        sa.Column("benchmark_multiplier", sa.Numeric(10, 6), nullable=True),
        sa.Column("reimburse_vat", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.UniqueConstraint("policy_id", "country_code", "effective_from", name="uq_policy_country_effective_from"),
    )

    op.create_table(
        "fuel_benchmark_prices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("airfield_code", sa.String(length=8), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("fuel_type", sa.String(length=32), nullable=False),
        sa.Column("price_per_unit", sa.Numeric(12, 6), nullable=False),
        sa.Column("unit", sa.String(length=3), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("includes_vat", sa.Boolean(), nullable=False),
        sa.Column("vat_rate", sa.Numeric(10, 6), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("airfield_code", "effective_from", "includes_vat", name="uq_benchmark_effective_vat"),
    )
    op.create_index("ix_fuel_benchmark_prices_airfield_code", "fuel_benchmark_prices", ["airfield_code"], unique=False)

    op.create_table(
        "fx_rates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("base_currency", sa.String(length=3), nullable=False),
        sa.Column("quote_currency", sa.String(length=3), nullable=False),
        sa.Column("rate", sa.Numeric(18, 10), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("effective_date", "base_currency", "quote_currency", name="uq_fx_rate"),
    )
    op.create_index("ix_fx_rates_effective_date", "fx_rates", ["effective_date"], unique=False)

    op.create_table(
        "fuel_expenses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("aircraft_id", sa.Integer(), sa.ForeignKey("aircraft.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pilot_id", sa.Integer(), sa.ForeignKey("pilots.id", ondelete="SET NULL"), nullable=True),
        sa.Column("purchased_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("country_code", sa.String(length=2), nullable=False),
        sa.Column("airfield_code", sa.String(length=8), nullable=True),
        sa.Column("vendor", sa.String(length=120), nullable=True),
        sa.Column("volume", sa.Numeric(12, 4), nullable=False),
        sa.Column("unit", sa.String(length=3), nullable=False),
        sa.Column("total_amount", sa.Numeric(14, 4), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("vat_amount", sa.Numeric(14, 4), nullable=True),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_index("ix_fuel_expenses_purchased_at", "fuel_expenses", ["purchased_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_fuel_expenses_purchased_at", table_name="fuel_expenses")
    op.drop_table("fuel_expenses")
    op.drop_index("ix_fx_rates_effective_date", table_name="fx_rates")
    op.drop_table("fx_rates")
    op.drop_index("ix_fuel_benchmark_prices_airfield_code", table_name="fuel_benchmark_prices")
    op.drop_table("fuel_benchmark_prices")
    op.drop_table("fuel_policy_country_rates")
    op.drop_table("fuel_policies")
    op.drop_table("pilots")
    op.drop_table("aircraft")
    op.drop_index("ix_admin_users_email", table_name="admin_users")
    op.drop_table("admin_users")
    op.execute("DROP TYPE IF EXISTS countrycalctype")

