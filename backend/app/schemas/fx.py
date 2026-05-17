from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class FxRateOut(BaseModel):
    id: int
    effective_date: date
    base_currency: str
    quote_currency: str
    rate: float
    source: str


class FxQuoteOut(BaseModel):
    effective_date: date
    base_currency: str
    quote_currency: str
    rate: float
    source: str
    derived: bool
    derivation: str


class FxTimeseriesPoint(BaseModel):
    effective_date: date
    rate: float


class FxTimeseriesOut(BaseModel):
    base_currency: str
    quote_currency: str
    start_date: date
    end_date: date
    derived: bool
    derivation: str
    source: str
    points: list[FxTimeseriesPoint]

