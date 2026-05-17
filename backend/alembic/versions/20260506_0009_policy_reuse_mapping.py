"""Policy reuse via aircraft_fuel_policies mapping.

Revision ID: 20260506_0009
Revises: 20260506_0008
Create Date: 2026-05-06
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260506_0009"
down_revision = "20260506_0008"
branch_labels = None
depends_on = None

# Children that FK to fuel_policies — must drop before DROP TABLE fuel_policies on PostgreSQL.
_POLICY_CHILD_TABLES = (
    "fuel_policy_country_rates",
    "fuel_benchmark_prices",
    "aircraft_fuel_policies",
)


def _drop_foreign_keys_to_fuel_policies(conn: sa.Connection) -> None:
    insp = sa.inspect(conn)
    tables = set(insp.get_table_names())
    for table_name in _POLICY_CHILD_TABLES:
        if table_name not in tables:
            continue
        for fk in insp.get_foreign_keys(table_name):
            if fk.get("referred_table") != "fuel_policies":
                continue
            name = fk.get("name")
            if not name:
                continue
            op.drop_constraint(name, table_name, type_="foreignkey")


def _create_foreign_keys_to_fuel_policies() -> None:
    op.create_foreign_key(
        None,
        "fuel_policy_country_rates",
        "fuel_policies",
        ["policy_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        None,
        "fuel_benchmark_prices",
        "fuel_policies",
        ["policy_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        None,
        "aircraft_fuel_policies",
        "fuel_policies",
        ["fuel_policy_id"],
        ["id"],
        ondelete="CASCADE",
    )


def upgrade() -> None:
    conn = op.get_bind()

    # 1) Create mapping table.
    op.create_table(
        "aircraft_fuel_policies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("aircraft_id", sa.Integer(), sa.ForeignKey("aircraft.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fuel_policy_id", sa.Integer(), sa.ForeignKey("fuel_policies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("aircraft_id", name="uq_aircraft_policy_aircraft"),
    )
    op.create_index("ix_aircraft_fuel_policies_aircraft_id", "aircraft_fuel_policies", ["aircraft_id"], unique=False)
    op.create_index("ix_aircraft_fuel_policies_fuel_policy_id", "aircraft_fuel_policies", ["fuel_policy_id"], unique=False)

    # 2) Rebuild fuel_policies to remove aircraft_id and add owner_admin_user_id.
    op.create_table(
        "fuel_policies__new",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "owner_admin_user_id",
            sa.Integer(),
            sa.ForeignKey("admin_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("base_currency", sa.String(length=3), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_index(
        "ix_fuel_policies_owner_admin_user_id__new",
        "fuel_policies__new",
        ["owner_admin_user_id"],
        unique=False,
    )

    # Backfill owner_admin_user_id from aircraft.admin_user_id using the old aircraft_id column.
    conn.execute(
        sa.text(
            """
            INSERT INTO fuel_policies__new (id, owner_admin_user_id, base_currency, created_at, updated_at)
            SELECT
              fp.id,
              a.admin_user_id,
              fp.base_currency,
              fp.created_at,
              fp.updated_at
            FROM fuel_policies fp
            JOIN aircraft a ON a.id = fp.aircraft_id
            """
        )
    )

    # Backfill mapping: aircraft -> policy (1:1 from old design)
    conn.execute(
        sa.text(
            """
            INSERT INTO aircraft_fuel_policies (aircraft_id, fuel_policy_id, created_at)
            SELECT fp.aircraft_id, fp.id, CURRENT_TIMESTAMP
            FROM fuel_policies fp
            """
        )
    )

    # PostgreSQL rejects DROP TABLE while dependents hold FKs to it; SQLite cannot ALTER ADD FK (see batch mode).
    if conn.dialect.name == "postgresql":
        _drop_foreign_keys_to_fuel_policies(conn)
    op.drop_table("fuel_policies")
    op.rename_table("fuel_policies__new", "fuel_policies")
    op.drop_index("ix_fuel_policies_owner_admin_user_id__new", table_name="fuel_policies")
    op.create_index("ix_fuel_policies_owner_admin_user_id", "fuel_policies", ["owner_admin_user_id"], unique=False)
    if conn.dialect.name == "postgresql":
        _create_foreign_keys_to_fuel_policies()


def downgrade() -> None:
    raise RuntimeError("Downgrade not supported for 20260506_0009")

