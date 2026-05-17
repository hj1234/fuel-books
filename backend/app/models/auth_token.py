from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AuthTokenPurpose(str, enum.Enum):
    PASSWORD_RESET = "PASSWORD_RESET"
    EMAIL_VERIFY = "EMAIL_VERIFY"
    EMAIL_CHANGE = "EMAIL_CHANGE"


class AuthToken(Base):
    __tablename__ = "auth_tokens"
    __table_args__ = (
        Index("ix_auth_tokens_user_purpose", "user_id", "purpose"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # sha256 hex of the plaintext token; plaintext is never persisted.
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    purpose: Mapped[AuthTokenPurpose] = mapped_column(Enum(AuthTokenPurpose), nullable=False)

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Used by EMAIL_CHANGE: holds the candidate new address until the user clicks confirm.
    new_email: Mapped[str | None] = mapped_column(String(320), nullable=True)

    # Light-weight forensics for the audit trail; never required.
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship()


from app.models.user import User  # noqa: E402
