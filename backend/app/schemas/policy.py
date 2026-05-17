from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class FuelPolicyOut(BaseModel):
    id: str
    aircraft_id: str
    base_currency: str


class FuelPolicyUpsert(BaseModel):
    base_currency: str = Field(default="GBP", min_length=3, max_length=3)


class CountryRateUpsert(BaseModel):
    country_code: str = Field(min_length=2, max_length=3, description="ISO-2 country code or ROW")
    effective_from: date
    effective_to: date | None = None
    calc_type: str
    percent_rate: float | None = None
    benchmark_airfield_code: str | None = Field(default=None, max_length=8)
    benchmark_multiplier: float | None = None
    reimburse_vat: bool = False


class CountryRateOut(CountryRateUpsert):
    # Internal-only ids: country rates are addressed by (policy + country),
    # never by their own id, so leaving them as integers is fine.
    id: int
    policy_id: str


class PolicyImportCandidateOut(BaseModel):
    aircraft_id: str
    aircraft_registration: str
    policy_id: str
    base_currency: str
    home_base_airfield: str | None = None


class PolicyImportPayload(BaseModel):
    source_aircraft_id: str
