from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import CountryCalcType


class FuelPolicy(Base):
    __tablename__ = "fuel_policies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        String(36), nullable=False, unique=True, index=True, default=lambda: str(uuid.uuid4())
    )
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    base_currency: Mapped[str] = mapped_column(String(3), nullable=False, default="GBP")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    country_rates: Mapped[list["FuelPolicyCountryRate"]] = relationship(
        back_populates="policy", cascade="all, delete-orphan"
    )


class FuelPolicyCountryRate(Base):
    __tablename__ = "fuel_policy_country_rates"
    __table_args__ = (
        UniqueConstraint("policy_id", "country_code", "effective_from", name="uq_policy_country_effective_from"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    policy_id: Mapped[int] = mapped_column(ForeignKey("fuel_policies.id", ondelete="CASCADE"), nullable=False)

    # ISO-3166-1 alpha-2, or special value "ROW" (rest of world)
    country_code: Mapped[str] = mapped_column(String(3), nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)

    calc_type: Mapped[CountryCalcType] = mapped_column(Enum(CountryCalcType), nullable=False)

    percent_rate: Mapped[float | None] = mapped_column(Numeric(10, 6), nullable=True)
    benchmark_airfield_code: Mapped[str | None] = mapped_column(String(8), nullable=True)
    benchmark_multiplier: Mapped[float | None] = mapped_column(Numeric(10, 6), nullable=True)

    reimburse_vat: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    policy: Mapped["FuelPolicy"] = relationship(back_populates="country_rates")


from app.models.user import User  # noqa: E402

