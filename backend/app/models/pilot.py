from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Pilot(Base):
    __tablename__ = "pilots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        String(36), nullable=False, unique=True, index=True, default=lambda: str(uuid.uuid4())
    )
    aircraft_id: Mapped[int] = mapped_column(ForeignKey("aircraft.id", ondelete="CASCADE"), nullable=False)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    aircraft: Mapped["Aircraft"] = relationship(back_populates="pilots")


from app.models.aircraft import Aircraft  # noqa: E402

