from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MembershipRole(str, enum.Enum):
    ADMIN = "ADMIN"
    PILOT = "PILOT"


class MembershipStatus(str, enum.Enum):
    INVITED = "INVITED"
    ACTIVE = "ACTIVE"
    REMOVED = "REMOVED"


class AircraftMembership(Base):
    __tablename__ = "aircraft_memberships"
    __table_args__ = (
        UniqueConstraint("aircraft_id", "user_id", name="uq_aircraft_membership_user"),
        UniqueConstraint("aircraft_id", "invited_email", name="uq_aircraft_membership_invited_email"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        String(36), nullable=False, unique=True, index=True, default=lambda: str(uuid.uuid4())
    )
    aircraft_id: Mapped[int] = mapped_column(ForeignKey("aircraft.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    invited_email: Mapped[str | None] = mapped_column(String(320), nullable=True)

    role: Mapped[MembershipRole] = mapped_column(Enum(MembershipRole), nullable=False)
    status: Mapped[MembershipStatus] = mapped_column(Enum(MembershipStatus), nullable=False)

    invited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    aircraft: Mapped["Aircraft"] = relationship()
    user: Mapped["User | None"] = relationship()


from app.models.aircraft import Aircraft  # noqa: E402
from app.models.user import User  # noqa: E402

