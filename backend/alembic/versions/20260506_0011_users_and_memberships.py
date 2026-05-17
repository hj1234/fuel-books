"""Users + aircraft memberships (admin/pilot roles).

Revision ID: 20260506_0011
Revises: 20260506_0010
Create Date: 2026-05-06
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260506_0011"
down_revision = "20260506_0010"
branch_labels = None
depends_on = None


def _drop_foreign_keys_referencing(conn: sa.Connection, referred_table: str) -> None:
    """PostgreSQL-only callers: DROP TABLE fails while child FKs reference the table."""
    insp = sa.inspect(conn)
    for table_name in insp.get_table_names():
        for fk in insp.get_foreign_keys(table_name):
            if fk.get("referred_table") != referred_table:
                continue
            name = fk.get("name")
            if not name:
                continue
            op.drop_constraint(name, table_name, type_="foreignkey")


def _restore_users_child_foreign_keys() -> None:
    op.create_foreign_key(
        None,
        "aircraft",
        "users",
        ["admin_user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        None,
        "fuel_policies",
        "users",
        ["owner_admin_user_id"],
        ["id"],
        ondelete="CASCADE",
    )


def _restore_aircraft_child_foreign_keys() -> None:
    op.create_foreign_key(
        None,
        "pilots",
        "aircraft",
        ["aircraft_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        None,
        "aircraft_fuel_policies",
        "aircraft",
        ["aircraft_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        None,
        "fuel_expenses",
        "aircraft",
        ["aircraft_id"],
        ["id"],
        ondelete="CASCADE",
    )


def _restore_fuel_policies_child_foreign_keys() -> None:
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
    insp = sa.inspect(conn)
    existing_tables = set(insp.get_table_names())

    # 1) Rename admin_users -> users
    if "admin_users" in existing_tables and "users" not in existing_tables:
        op.rename_table("admin_users", "users")

    # 2) Rebuild users table to add can_login and allow nullable password_hash/email
    # If a previous attempt partially ran, make sure legacy index names don't block rebuild.
    op.execute("DROP INDEX IF EXISTS ix_admin_users_email")
    op.execute("DROP INDEX IF EXISTS ix_users_email")

    op.create_table(
        "users__new",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("can_login", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email__new", "users__new", ["email"], unique=False)

    conn.execute(
        sa.text(
            """
            INSERT INTO users__new (id, email, full_name, password_hash, can_login, created_at, updated_at)
            SELECT id, email, full_name, password_hash, true, created_at, updated_at
            FROM users
            """
        )
    )

    # PostgreSQL: dependents (aircraft, fuel_policies) hold FKs to users — drop before DROP TABLE.
    if conn.dialect.name == "postgresql":
        _drop_foreign_keys_referencing(conn, "users")
    op.drop_table("users")
    op.rename_table("users__new", "users")
    op.drop_index("ix_users_email__new", table_name="users")
    op.create_index("ix_users_email", "users", ["email"], unique=False)
    if conn.dialect.name == "postgresql":
        _restore_users_child_foreign_keys()

    # 3) Rebuild aircraft to rename admin_user_id -> owner_user_id and point FK to users
    # PostgreSQL: explicit UNIQUE name matches old table — drop before creating __new.
    if conn.dialect.name == "postgresql":
        op.drop_constraint("uq_aircraft_owner_registration", "aircraft", type_="unique")

    op.create_table(
        "aircraft__new",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("registration", sa.String(length=32), nullable=False),
        sa.Column("make", sa.String(length=80), nullable=False),
        sa.Column("model", sa.String(length=80), nullable=False),
        sa.Column("home_base_airfield", sa.String(length=8), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("owner_user_id", "registration", name="uq_aircraft_owner_registration"),
    )

    conn.execute(
        sa.text(
            """
            INSERT INTO aircraft__new (id, owner_user_id, registration, make, model, home_base_airfield, created_at, updated_at)
            SELECT id, admin_user_id, registration, make, model, home_base_airfield, created_at, updated_at
            FROM aircraft
            """
        )
    )
    if conn.dialect.name == "postgresql":
        _drop_foreign_keys_referencing(conn, "aircraft")
    op.drop_table("aircraft")
    op.rename_table("aircraft__new", "aircraft")
    if conn.dialect.name == "postgresql":
        _restore_aircraft_child_foreign_keys()

    # 4) Rebuild fuel_policies to rename owner_admin_user_id -> owner_user_id and point FK to users
    op.create_table(
        "fuel_policies__new",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("base_currency", sa.String(length=3), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_index("ix_fuel_policies_owner_user_id__new", "fuel_policies__new", ["owner_user_id"], unique=False)
    conn.execute(
        sa.text(
            """
            INSERT INTO fuel_policies__new (id, owner_user_id, base_currency, created_at, updated_at)
            SELECT id, owner_admin_user_id, base_currency, created_at, updated_at
            FROM fuel_policies
            """
        )
    )
    op.execute("DROP INDEX IF EXISTS ix_fuel_policies_owner_admin_user_id")
    if conn.dialect.name == "postgresql":
        _drop_foreign_keys_referencing(conn, "fuel_policies")
    op.drop_table("fuel_policies")
    op.rename_table("fuel_policies__new", "fuel_policies")
    op.drop_index("ix_fuel_policies_owner_user_id__new", table_name="fuel_policies")
    op.create_index("ix_fuel_policies_owner_user_id", "fuel_policies", ["owner_user_id"], unique=False)
    if conn.dialect.name == "postgresql":
        _restore_fuel_policies_child_foreign_keys()

    # 5) Add aircraft_memberships table
    op.create_table(
        "aircraft_memberships",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("aircraft_id", sa.Integer(), sa.ForeignKey("aircraft.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("invited_email", sa.String(length=320), nullable=True),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("invited_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("aircraft_id", "user_id", name="uq_aircraft_membership_user"),
        sa.UniqueConstraint("aircraft_id", "invited_email", name="uq_aircraft_membership_invited_email"),
    )
    op.create_index("ix_aircraft_memberships_aircraft_id", "aircraft_memberships", ["aircraft_id"], unique=False)
    op.create_index("ix_aircraft_memberships_user_id", "aircraft_memberships", ["user_id"], unique=False)

    # 6) Backfill owner ADMIN memberships for all aircraft
    conn.execute(
        sa.text(
            """
            INSERT INTO aircraft_memberships (aircraft_id, user_id, invited_email, role, status, invited_at, accepted_at)
            SELECT id, owner_user_id, NULL, 'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            FROM aircraft
            """
        )
    )

    # 7) Migrate existing pilots into users (can_login=0) and memberships (PILOT/ACTIVE)
    # Create user rows from pilots; allow null email for name-only pilots.
    # Note: SQLite allows multiple NULLs in a UNIQUE column.
    pilot_rows = conn.execute(sa.text("SELECT id, aircraft_id, name, email FROM pilots")).fetchall()
    membership_sql = (
        """
                INSERT INTO aircraft_memberships
                  (aircraft_id, user_id, invited_email, role, status, invited_at, accepted_at)
                VALUES
                  (:aircraft_id, :user_id, NULL, 'PILOT', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (aircraft_id, user_id) DO NOTHING
                """
        if conn.dialect.name == "postgresql"
        else """
                INSERT OR IGNORE INTO aircraft_memberships
                  (aircraft_id, user_id, invited_email, role, status, invited_at, accepted_at)
                VALUES
                  (:aircraft_id, :user_id, NULL, 'PILOT', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """
    )
    for _pid, aircraft_id, name, email in pilot_rows:
        existing_user_id = None
        if email:
            existing_user_id = conn.execute(sa.text("SELECT id FROM users WHERE email = :email"), {"email": email}).scalar()

        if existing_user_id:
            user_id = existing_user_id
        else:
            user_id = conn.execute(
                sa.text(
                    """
                    INSERT INTO users (email, full_name, password_hash, can_login, created_at, updated_at)
                    VALUES (:email, :full_name, NULL, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING id
                    """
                ),
                {"email": email, "full_name": name},
            ).scalar_one()

        conn.execute(
            sa.text(membership_sql),
            {"aircraft_id": aircraft_id, "user_id": user_id},
        )


def downgrade() -> None:
    raise RuntimeError("Downgrade not supported for 20260506_0011")

