from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AircraftFuelPolicy(Base):
    __tablename__ = "aircraft_fuel_policies"
    __table_args__ = (UniqueConstraint("aircraft_id", name="uq_aircraft_policy_aircraft"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    aircraft_id: Mapped[int] = mapped_column(ForeignKey("aircraft.id", ondelete="CASCADE"), nullable=False, index=True)
    fuel_policy_id: Mapped[int] = mapped_column(
        ForeignKey("fuel_policies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    aircraft: Mapped["Aircraft"] = relationship(back_populates="fuel_policy_mapping")
    fuel_policy: Mapped["FuelPolicy"] = relationship()


from app.models.aircraft import Aircraft  # noqa: E402
from app.models.fuel_policy import FuelPolicy  # noqa: E402

