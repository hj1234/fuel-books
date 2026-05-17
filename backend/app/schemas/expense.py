from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class FuelExpenseCreate(BaseModel):
    purchased_at: datetime
    country_code: str = Field(min_length=2, max_length=64)
    airfield_code: str | None = Field(default=None, max_length=8)
    vendor: str | None = Field(default=None, max_length=120)
    volume: float = Field(gt=0)
    unit: str = Field(default="L", max_length=3)
    total_amount: float = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3)
    vat_amount: float | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=1000)
    pilot_id: str | None = None


class FuelExpenseUpdate(BaseModel):
    purchased_at: datetime | None = None
    country_code: str | None = Field(default=None, min_length=2, max_length=64)
    airfield_code: str | None = Field(default=None, max_length=8)
    vendor: str | None = Field(default=None, max_length=120)
    volume: float | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, max_length=3)
    total_amount: float | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    vat_amount: float | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=1000)
    pilot_id: str | None = None


class FuelExpenseRefundPreviewOut(BaseModel):
    effective_date: date
    refund_amount: float
    refund_currency: str
    derivation: str
    explanation: str
    details: dict | None = None


class FuelExpenseCalculationOut(BaseModel):
    # `id` here is an internal calculation row id (never used in URLs); kept as
    # int because the frontend only uses it as a React key.
    id: int
    created_at: datetime
    effective_date: date
    refund_amount: float
    refund_currency: str
    derivation: str
    explanation: str
    details: dict | None = None


class FuelExpenseOut(BaseModel):
    id: str
    aircraft_id: str
    pilot_id: str | None
    purchased_at: datetime
    country_code: str
    airfield_code: str | None
    vendor: str | None
    volume: float
    unit: str
    total_amount: float
    currency: str
    vat_amount: float | None
    notes: str | None

    latest_calculation: FuelExpenseCalculationOut | None = None


class FuelExpenseListOut(BaseModel):
    items: list[FuelExpenseOut]
    total: int
    limit: int
    offset: int
