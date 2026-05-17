"""Seed demo data (dev-only).

Revision ID: 20260506_0002
Revises: 20260506_0001
Create Date: 2026-05-06
"""

from __future__ import annotations

import os
from datetime import date

import sqlalchemy as sa
from alembic import op


revision = "20260506_0002"
down_revision = "20260506_0001"
branch_labels = None
depends_on = None


def _is_truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def upgrade() -> None:
    # Seeding is consolidated into a later migration.
    # Keep this revision as a no-op for existing databases that already have it applied.
    return

    seed_password = os.getenv("SEED_ADMIN_PASSWORD") or "password1"

    # Seed must create a valid password hash, otherwise login will fail later.
    # If hashing isn't available, fail loudly so the user can fix deps (bcrypt/passlib).
    password_hash = None
    try:
        from app.core.security import hash_password  # type: ignore

        password_hash = hash_password(seed_password)
    except Exception as e:
        raise RuntimeError(
            "Failed to hash seed admin password. Ensure bcrypt/passlib are installed and compatible."
        ) from e

    conn = op.get_bind()

    admin_id = conn.execute(
        sa.text(
            """
            INSERT INTO admin_users (email, full_name, password_hash, created_at, updated_at)
            VALUES (:email, :full_name, :password_hash, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(email) DO UPDATE SET full_name=excluded.full_name
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

    pilot_id = conn.execute(
        sa.text(
            """
            INSERT INTO pilots (aircraft_id, name, email, created_at, updated_at)
            VALUES (:aircraft_id, :name, :email, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
            """
        ),
        {"aircraft_id": aircraft_id, "name": "Henry Jolliffe", "email": "henry.jolliffe@gmail.com"},
    ).scalar_one()

    policy_id = conn.execute(
        sa.text(
            """
            INSERT INTO fuel_policies (aircraft_id, base_currency, created_at, updated_at)
            VALUES (:aircraft_id, :base_currency, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(aircraft_id) DO UPDATE SET base_currency=excluded.base_currency
            RETURNING id
            """
        ),
        {"aircraft_id": aircraft_id, "base_currency": "GBP"},
    ).scalar_one()

    # Country rules for the example policy:
    # - GB: actuals capped to benchmark (EGHO) * 1.10, VAT reimbursed
    # - JE/GG: reimburse benchmark ex VAT (EGHO), VAT not reimbursed
    conn.execute(
        sa.text(
            """
            INSERT INTO fuel_policy_country_rates
              (policy_id, country_code, effective_from, effective_to, calc_type, percent_rate, benchmark_airfield_code, benchmark_multiplier, reimburse_vat)
            VALUES
              (:policy_id, 'GB', :effective_from, NULL, 'ACTUALS_CAPPED_TO_BENCHMARK', NULL, 'EGHO', 1.10, 1),
              (:policy_id, 'JE', :effective_from, NULL, 'BENCHMARK_EX_VAT', NULL, 'EGHO', NULL, 0),
              (:policy_id, 'GG', :effective_from, NULL, 'BENCHMARK_EX_VAT', NULL, 'EGHO', NULL, 0)
            ON CONFLICT(policy_id, country_code, effective_from) DO NOTHING
            """
        ),
        {"policy_id": policy_id, "effective_from": date(2025, 1, 1)},
    )

    # Benchmark price table replacement (as provided): EGHO inc-VAT only.
    # Note: refund calculation supports deriving ex-VAT from inc-VAT using vat_rate.
    conn.execute(sa.text("DELETE FROM fuel_benchmark_prices"))

    benchmark_rows_inc_vat = [
        (date(2025, 5, 19), 1.96),
        (date(2025, 6, 24), 1.98),
        (date(2026, 3, 3), 1.98),
        (date(2026, 3, 12), 2.04),
        (date(2026, 4, 1), 2.14),
    ]

    for effective_from, inc_vat in benchmark_rows_inc_vat:
        conn.execute(
            sa.text(
                """
                INSERT INTO fuel_benchmark_prices
                  (policy_id, airfield_code, effective_from, fuel_type, price_per_unit, unit, currency, includes_vat, vat_rate, created_at, updated_at)
                VALUES
                  (:policy_id, 'EGHO', :effective_from, 'AVGAS', :inc_vat, 'L', 'GBP', 1, 0.20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """
            ),
            {"policy_id": policy_id, "effective_from": effective_from, "inc_vat": inc_vat},
        )

    # Optional: seed a sample fuel expense row (not requested), so skip for now.
    _ = pilot_id


def downgrade() -> None:
    # Intentionally non-destructive: do not delete user data on downgrade.
    pass

