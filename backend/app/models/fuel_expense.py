from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import VolumeUnit


class FuelExpense(Base):
    __tablename__ = "fuel_expenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        String(36), nullable=False, unique=True, index=True, default=lambda: str(uuid.uuid4())
    )
    aircraft_id: Mapped[int] = mapped_column(ForeignKey("aircraft.id", ondelete="CASCADE"), nullable=False)
    pilot_id: Mapped[int | None] = mapped_column(ForeignKey("pilots.id", ondelete="SET NULL"), nullable=True)

    purchased_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    country_code: Mapped[str] = mapped_column(String(64), nullable=False)
    airfield_code: Mapped[str | None] = mapped_column(String(8), nullable=True)
    vendor: Mapped[str | None] = mapped_column(String(120), nullable=True)

    volume: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    unit: Mapped[str] = mapped_column(String(3), nullable=False, default=VolumeUnit.L.value)

    total_amount: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    vat_amount: Mapped[float | None] = mapped_column(Numeric(14, 4), nullable=True)

    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    aircraft: Mapped["Aircraft"] = relationship(back_populates="fuel_expenses")
    pilot: Mapped["Pilot | None"] = relationship()
    calculations: Mapped[list["FuelExpenseCalculation"]] = relationship(
        back_populates="fuel_expense", cascade="all, delete-orphan", order_by="FuelExpenseCalculation.id"
    )


from app.models.aircraft import Aircraft  # noqa: E402
from app.models.fuel_expense_calculation import FuelExpenseCalculation  # noqa: E402
from app.models.pilot import Pilot  # noqa: E402

