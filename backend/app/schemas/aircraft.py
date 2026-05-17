from __future__ import annotations

from pydantic import BaseModel, Field


class AircraftCreate(BaseModel):
    registration: str = Field(min_length=1, max_length=32)
    make: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=80)
    home_base_airfield: str = Field(min_length=1, max_length=8)


class AircraftUpdate(BaseModel):
    registration: str | None = Field(default=None, min_length=1, max_length=32)
    make: str | None = Field(default=None, min_length=1, max_length=80)
    model: str | None = Field(default=None, min_length=1, max_length=80)
    home_base_airfield: str | None = Field(default=None, max_length=8)


class AircraftOut(BaseModel):
    # Public UUID identifier; the internal integer PK is never exposed.
    id: str
    registration: str
    make: str
    model: str
    home_base_airfield: str | None
