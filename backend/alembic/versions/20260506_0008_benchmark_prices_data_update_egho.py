"""Update EGHO benchmark prices (policy_id=1) to latest series.

Revision ID: 20260506_0008
Revises: 20260506_0007
Create Date: 2026-05-06
"""

from __future__ import annotations

from datetime import date

import sqlalchemy as sa
from alembic import op


revision = "20260506_0008"
down_revision = "20260506_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Data updates are consolidated into the latest dev seed migration.
    return


def downgrade() -> None:
    # Non-destructive by default.
    pass

