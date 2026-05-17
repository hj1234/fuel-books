from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import VolumeUnit


class FuelBenchmarkPrice(Base):
    __tablename__ = "fuel_benchmark_prices"
    __table_args__ = (
        UniqueConstraint("policy_id", "airfield_code", "effective_from", "includes_vat", name="uq_benchmark_effective_vat"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        String(36), nullable=False, unique=True, index=True, default=lambda: str(uuid.uuid4())
    )
    policy_id: Mapped[int] = mapped_column(ForeignKey("fuel_policies.id", ondelete="CASCADE"), nullable=False, index=True)

    airfield_code: Mapped[str] = mapped_column(String(8), nullable=False, index=True)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)

    fuel_type: Mapped[str] = mapped_column(String(32), nullable=False, default="AVGAS")
    # Stored as ex-VAT price per unit. To compute inc-VAT: ex_vat * (1 + vat_rate)
    price_per_unit: Mapped[float] = mapped_column(Numeric(12, 6), nullable=False)
    unit: Mapped[VolumeUnit] = mapped_column(String(3), nullable=False, default=VolumeUnit.L.value)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="GBP")

    includes_vat: Mapped[bool] = mapped_column(Boolean, nullable=False)
    vat_rate: Mapped[float] = mapped_column(Numeric(10, 6), nullable=False, default=0.2)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    policy: Mapped["FuelPolicy"] = relationship()


from app.models.fuel_policy import FuelPolicy  # noqa: E402
