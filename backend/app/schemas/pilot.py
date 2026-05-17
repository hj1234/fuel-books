from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class PilotCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr | None = None


class PilotOut(BaseModel):
    id: str
    aircraft_id: str
    name: str
    email: EmailStr | None
