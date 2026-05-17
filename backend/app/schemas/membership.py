from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class MembershipCreate(BaseModel):
    # Note: integer user_id is intentionally not accepted here. Memberships are
    # created by inviting an email address; the link to a user account is
    # established server-side once the invitee registers.
    invited_email: EmailStr
    role: str = Field(pattern="^(ADMIN|PILOT)$")


class MembershipUpdate(BaseModel):
    role: str | None = Field(default=None, pattern="^(ADMIN|PILOT)$")
    status: str | None = Field(default=None, pattern="^(INVITED|ACTIVE|REMOVED)$")


class MembershipOut(BaseModel):
    id: str
    aircraft_id: str
    # The integer user id is intentionally not exposed. We expose the user's
    # email when the membership has been accepted, plus the original
    # invitation email — together these are enough for the UI to identify
    # who the membership belongs to without leaking internal IDs.
    user_email: str | None
    invited_email: str | None
    role: str
    status: str
    invited_at: datetime
    accepted_at: datetime | None
