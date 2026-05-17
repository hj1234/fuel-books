from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FxRate(Base):
    __tablename__ = "fx_rates"
    __table_args__ = (UniqueConstraint("effective_date", "base_currency", "quote_currency", name="uq_fx_rate"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    effective_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    base_currency: Mapped[str] = mapped_column(String(3), nullable=False)  # e.g. EUR
    quote_currency: Mapped[str] = mapped_column(String(3), nullable=False)  # e.g. GBP
    rate: Mapped[float] = mapped_column(Numeric(18, 10), nullable=False)  # 1 base = rate quote
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="ECB")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

