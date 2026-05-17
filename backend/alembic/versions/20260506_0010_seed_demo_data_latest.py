"""Seed demo data (latest schema, policy reuse mapping) (dev-only).

Revision ID: 20260506_0010
Revises: 20260506_0009
Create Date: 2026-05-06
"""

from __future__ import annotations

import os
from datetime import date

import sqlalchemy as sa
from alembic import op


revision = "20260506_0010"
down_revision = "20260506_0009"
branch_labels = None
depends_on = None


def _is_truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def upgrade() -> None:
    if not _is_truthy(os.getenv("SEED_DEMO_DATA")):
        return

    seed_password = os.getenv("SEED_ADMIN_PASSWORD") or "password1"
    try:
        from app.core.security import hash_password  # type: ignore

        password_hash = hash_password(seed_password)
    except Exception as e:
        raise RuntimeError(
            "Failed to hash seed admin password. Ensure bcrypt/passlib are installed and compatible."
        ) from e

    conn = op.get_bind()

    # Wipe demo-scoped tables (safe for dev only).
    conn.execute(sa.text("DELETE FROM fuel_expense_calculations"))
    conn.execute(sa.text("DELETE FROM fuel_expenses"))
    conn.execute(sa.text("DELETE FROM fuel_policy_country_rates"))
    conn.execute(sa.text("DELETE FROM fuel_benchmark_prices"))
    conn.execute(sa.text("DELETE FROM aircraft_fuel_policies"))
    conn.execute(sa.text("DELETE FROM fuel_policies"))
    conn.execute(sa.text("DELETE FROM pilots"))
    conn.execute(sa.text("DELETE FROM aircraft"))
    conn.execute(sa.text("DELETE FROM admin_users"))

    admin_id = conn.execute(
        sa.text(
            """
            INSERT INTO admin_users (email, full_name, password_hash, created_at, updated_at)
            VALUES (:email, :full_name, :password_hash, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
            """
        ),
        {
            "email": "henry.jolliffe@gmail.com",
            "full_name": "Henry Jolliffe",
            "password_hash": password_hash,
        },
    ).scalar_one()

    aircraft_id = conn.execute(
        sa.text(
            """
            INSERT INTO aircraft (admin_user_id, registration, make, model, home_base_airfield, created_at, updated_at)
            VALUES (:admin_user_id, :registration, :make, :model, :home_base_airfield, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
            """
        ),
        {
            "admin_user_id": admin_id,
            "registration": "G-AZFM",
            "make": "Piper",
            "model": "PA28-200R",
            "home_base_airfield": "EGHO",
        },
    ).scalar_one()

    _pilot_id = conn.execute(
        sa.text(
            """
            INSERT INTO pilots (aircraft_id, name, email, created_at, updated_at)
            VALUES (:aircraft_id, :name, :email, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
            """
        ),
        {"aircraft_id": aircraft_id, "name": "Henry Jolliffe", "email": "henry.jolliffe@gmail.com"},
    ).scalar_one()

    # Create reusable policy template
    policy_id = conn.execute(
        sa.text(
            """
            INSERT INTO fuel_policies (owner_admin_user_id, base_currency, created_at, updated_at)
            VALUES (:owner_admin_user_id, :base_currency, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
            """
        ),
        {"owner_admin_user_id": admin_id, "base_currency": "GBP"},
    ).scalar_one()

    # Map aircraft -> policy (requested)
    conn.execute(
        sa.text(
            """
            INSERT INTO aircraft_fuel_policies (aircraft_id, fuel_policy_id, created_at)
            VALUES (:aircraft_id, :fuel_policy_id, CURRENT_TIMESTAMP)
            """
        ),
        {"aircraft_id": aircraft_id, "fuel_policy_id": policy_id},
    )

    # Country rules
    conn.execute(
        sa.text(
            """
            INSERT INTO fuel_policy_country_rates
              (policy_id, country_code, effective_from, effective_to, calc_type, percent_rate, benchmark_airfield_code, benchmark_multiplier, reimburse_vat)
            VALUES
              (:policy_id, 'GB', :effective_from, NULL, 'ACTUALS_CAPPED_TO_BENCHMARK', NULL, 'EGHO', 1.10, true),
              (:policy_id, 'JE', :effective_from, NULL, 'BENCHMARK_EX_VAT', NULL, 'EGHO', NULL, false),
              (:policy_id, 'GG', :effective_from, NULL, 'BENCHMARK_EX_VAT', NULL, 'EGHO', NULL, false),
              (:policy_id, 'ROW', :effective_from, NULL, 'ACTUALS_CAPPED_TO_BENCHMARK_EX_VAT', NULL, 'EGHO', 1.10, false)
            """
        ),
        {"policy_id": policy_id, "effective_from": date(2025, 1, 1)},
    )

    # Benchmark prices (EGHO, inc-VAT only) - latest series
    benchmark_rows_inc_vat = [
        (date(2025, 5, 19), 1.96),
        (date(2025, 6, 24), 1.98),
        (date(2026, 3, 3), 1.98),
        (date(2026, 3, 12), 2.04),
        (date(2026, 4, 1), 2.09),
        (date(2026, 5, 1), 2.14),
    ]

    for effective_from, inc_vat in benchmark_rows_inc_vat:
        conn.execute(
            sa.text(
                """
                INSERT INTO fuel_benchmark_prices
                  (policy_id, airfield_code, effective_from, fuel_type, price_per_unit, unit, currency, includes_vat, vat_rate, created_at, updated_at)
                VALUES
                  (:policy_id, 'EGHO', :effective_from, 'AVGAS', :inc_vat, 'L', 'GBP', true, 0.20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """
            ),
            {"policy_id": policy_id, "effective_from": effective_from, "inc_vat": inc_vat},
        )


def downgrade() -> None:
    pass

