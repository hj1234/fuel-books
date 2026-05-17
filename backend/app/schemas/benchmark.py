from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class BenchmarkPriceCreate(BaseModel):
    policy_id: str
    airfield_code: str = Field(min_length=2, max_length=8)
    effective_from: date
    fuel_type: str = Field(default="AVGAS", min_length=1, max_length=32)
    price_per_unit: float = Field(gt=0)
    unit: str = Field(default="L", max_length=3)
    currency: str = Field(default="GBP", min_length=3, max_length=3)
    includes_vat: bool
    vat_rate: float = Field(default=0.20, ge=0)


class BenchmarkPriceOut(BaseModel):
    id: str
    policy_id: str
    airfield_code: str
    effective_from: date
    fuel_type: str
    price_per_unit: float
    unit: str
    currency: str
    includes_vat: bool
    vat_rate: float


class BenchmarkAircraftCandidateOut(BaseModel):
    """Admin aircraft for benchmark UI (policy fields absent until fuel policy is linked)."""

    aircraft_id: str
    aircraft_registration: str
    home_base_airfield: str | None = None
    policy_id: str | None = None
    base_currency: str | None = None
