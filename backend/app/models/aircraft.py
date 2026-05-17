from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Aircraft(Base):
    __tablename__ = "aircraft"
    __table_args__ = (UniqueConstraint("owner_user_id", "registration", name="uq_aircraft_owner_registration"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Opaque, URL-safe identifier. The integer `id` is kept for FK/joins only;
    # everything user-facing (URLs, API responses) uses `public_id`.
    public_id: Mapped[str] = mapped_column(
        String(36), nullable=False, unique=True, index=True, default=lambda: str(uuid.uuid4())
    )
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    registration: Mapped[str] = mapped_column(String(32), nullable=False)
    make: Mapped[str] = mapped_column(String(80), nullable=False)
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    home_base_airfield: Mapped[str | None] = mapped_column(String(8), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    owner: Mapped["User"] = relationship(back_populates="aircraft_owned")
    pilots: Mapped[list["Pilot"]] = relationship(back_populates="aircraft", cascade="all, delete-orphan")
    fuel_policy_mapping: Mapped["AircraftFuelPolicy | None"] = relationship(
        back_populates="aircraft", cascade="all, delete-orphan", uselist=False
    )
    fuel_expenses: Mapped[list["FuelExpense"]] = relationship(back_populates="aircraft", cascade="all, delete-orphan")


from app.models.user import User  # noqa: E402
from app.models.aircraft_fuel_policy import AircraftFuelPolicy  # noqa: E402
from app.models.fuel_expense import FuelExpense  # noqa: E402
from app.models.pilot import Pilot  # noqa: E402

