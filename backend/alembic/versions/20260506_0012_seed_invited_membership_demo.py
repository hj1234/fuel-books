"""Seed invited membership demo (dev-only).

Revision ID: 20260506_0012
Revises: 20260506_0011
Create Date: 2026-05-06
"""

from __future__ import annotations

import os

import sqlalchemy as sa
from alembic import op


revision = "20260506_0012"
down_revision = "20260506_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if os.getenv("FUELBOOKS_ENV", "dev") != "dev":
        return

    conn = op.get_bind()

    # Demo row targets aircraft_id=1 from seed 0010; production skips 0010 unless SEED_DEMO_DATA is set.
    if not conn.execute(sa.text("SELECT 1 FROM aircraft WHERE id = 1")).scalar():
        return

    # Add an invited-only pilot membership example for aircraft 1.
    # (No user_id yet; invitation flow will attach a user later.)
    stmt = (
        """
            INSERT INTO aircraft_memberships
              (aircraft_id, user_id, invited_email, role, status, invited_at, accepted_at)
            VALUES
              (1, NULL, 'invited.pilot@example.com', 'PILOT', 'INVITED', CURRENT_TIMESTAMP, NULL)
            ON CONFLICT (aircraft_id, invited_email) DO NOTHING
            """
        if conn.dialect.name == "postgresql"
        else """
            INSERT OR IGNORE INTO aircraft_memberships
              (aircraft_id, user_id, invited_email, role, status, invited_at, accepted_at)
            VALUES
              (1, NULL, 'invited.pilot@example.com', 'PILOT', 'INVITED', CURRENT_TIMESTAMP, NULL)
            """
    )
    conn.execute(sa.text(stmt))


def downgrade() -> None:
    # Dev-only seed.
    pass

