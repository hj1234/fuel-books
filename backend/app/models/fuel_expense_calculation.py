from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class FuelExpenseCalculation(Base):
    __tablename__ = "fuel_expense_calculations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fuel_expense_id: Mapped[int] = mapped_column(
        ForeignKey("fuel_expenses.id", ondelete="CASCADE"), nullable=False, index=True
    )

    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    policy_currency: Mapped[str] = mapped_column(String(3), nullable=False)

    refund_amount: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    refund_currency: Mapped[str] = mapped_column(String(3), nullable=False)

    derivation: Mapped[str] = mapped_column(String(200), nullable=False, default="")  # human/debug string
    explanation: Mapped[str] = mapped_column(String(500), nullable=False, default="")

    # JSON snapshot from calculate_refund_detailed at insert time (policy/FX/benchmark as-of then).
    details_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    fuel_expense: Mapped["FuelExpense"] = relationship(back_populates="calculations")


from app.models.fuel_expense import FuelExpense  # noqa: E402

