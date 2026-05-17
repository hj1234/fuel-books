from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.fx_rate import FxRate


@dataclass(frozen=True)
class FxQuote:
    effective_date: date
    base_currency: str
    quote_currency: str
    rate: Decimal  # 1 base = rate quote
    source: str
    derived: bool
    derivation: str


@dataclass(frozen=True)
class FxTimeseriesPoint:
    effective_date: date
    rate: Decimal


@dataclass(frozen=True)
class FxTimeseries:
    base_currency: str
    quote_currency: str
    start_date: date
    end_date: date
    derived: bool
    derivation: str
    source: str
    points: list[FxTimeseriesPoint]


def _get_eur_to(db: Session, *, quote_currency: str, on_or_before: date) -> FxRate | None:
    return db.scalar(
        select(FxRate)
        .where(
            FxRate.base_currency == "EUR",
            FxRate.quote_currency == quote_currency,
            FxRate.effective_date <= on_or_before,
        )
        .order_by(FxRate.effective_date.desc())
        .limit(1)
    )


def quote_fx(db: Session, *, base_currency: str, quote_currency: str, on_date: date) -> FxQuote:
    """
    Return an FX quote for a given day.

    Data source assumption:
    - DB stores ECB rates as EUR -> QUOTE for various quote currencies and dates.
    - If the exact date isn't present, use most recent prior date.

    Cross-rate math:
    - EUR->X exists: r_x
    - EUR->Y exists: r_y
    Then X->Y = r_y / r_x
    And X->EUR = 1 / r_x
    """
    base = base_currency.upper()
    quote = quote_currency.upper()
    if base == quote:
        return FxQuote(
            effective_date=on_date,
            base_currency=base,
            quote_currency=quote,
            rate=Decimal("1"),
            source="ECB",
            derived=True,
            derivation="IDENTITY",
        )

    # Direct stored case: EUR -> QUOTE
    if base == "EUR":
        row = _get_eur_to(db, quote_currency=quote, on_or_before=on_date)
        if not row:
            raise ValueError(f"Missing FX rate for EUR->{quote} on or before {on_date.isoformat()}")
        return FxQuote(
            effective_date=row.effective_date,
            base_currency="EUR",
            quote_currency=quote,
            rate=Decimal(str(row.rate)),
            source=row.source,
            derived=False,
            derivation="DIRECT",
        )

    # Inverse case: BASE -> EUR = 1 / (EUR -> BASE)
    if quote == "EUR":
        row_base = _get_eur_to(db, quote_currency=base, on_or_before=on_date)
        if not row_base:
            raise ValueError(f"Missing FX rate for EUR->{base} on or before {on_date.isoformat()}")
        rate = Decimal("1") / Decimal(str(row_base.rate))
        return FxQuote(
            effective_date=row_base.effective_date,
            base_currency=base,
            quote_currency="EUR",
            rate=rate,
            source=row_base.source,
            derived=True,
            derivation="INVERT(EUR->BASE)",
        )

    # Cross case: BASE -> QUOTE = (EUR->QUOTE) / (EUR->BASE)
    row_base = _get_eur_to(db, quote_currency=base, on_or_before=on_date)
    row_quote = _get_eur_to(db, quote_currency=quote, on_or_before=on_date)
    if not row_base or not row_quote:
        missing = []
        if not row_base:
            missing.append(f"EUR->{base}")
        if not row_quote:
            missing.append(f"EUR->{quote}")
        raise ValueError(f"Missing FX rate(s) {', '.join(missing)} on or before {on_date.isoformat()}")

    # Ensure both legs use a common effective date (avoid mixing days).
    common_date = min(row_base.effective_date, row_quote.effective_date)
    if common_date != row_base.effective_date:
        row_base = _get_eur_to(db, quote_currency=base, on_or_before=common_date)
    if common_date != row_quote.effective_date:
        row_quote = _get_eur_to(db, quote_currency=quote, on_or_before=common_date)
    assert row_base and row_quote

    rate = Decimal(str(row_quote.rate)) / Decimal(str(row_base.rate))
    return FxQuote(
        effective_date=common_date,
        base_currency=base,
        quote_currency=quote,
        rate=rate,
        source=row_quote.source,
        derived=True,
        derivation="CROSS((EUR->QUOTE)/(EUR->BASE))",
    )


def list_available_currencies(db: Session) -> list[str]:
    """Distinct currency codes that appear in stored FX rates (as either base or quote)."""
    bases = db.scalars(select(FxRate.base_currency).distinct()).all()
    quotes = db.scalars(select(FxRate.quote_currency).distinct()).all()
    return sorted({c for c in (*bases, *quotes) if c})


def _fetch_eur_series(
    db: Session, *, quote_currency: str, start_date: date, end_date: date
) -> list[FxRate]:
    return list(
        db.scalars(
            select(FxRate)
            .where(
                FxRate.base_currency == "EUR",
                FxRate.quote_currency == quote_currency,
                FxRate.effective_date >= start_date,
                FxRate.effective_date <= end_date,
            )
            .order_by(FxRate.effective_date)
        ).all()
    )


def quote_fx_timeseries(
    db: Session,
    *,
    base_currency: str,
    quote_currency: str,
    start_date: date,
    end_date: date,
) -> FxTimeseries:
    """
    Return a daily-resolution FX timeseries for BASE->QUOTE over [start_date, end_date].

    Uses the same derivation rules as `quote_fx`:
    - DIRECT when BASE == EUR
    - INVERT(EUR->BASE) when QUOTE == EUR
    - CROSS((EUR->QUOTE)/(EUR->BASE)) otherwise, joined on the union of available dates
      (each leg is carried forward from its last known value, ECB-style)
    """
    base = base_currency.upper()
    quote = quote_currency.upper()

    if base == quote:
        return FxTimeseries(
            base_currency=base,
            quote_currency=quote,
            start_date=start_date,
            end_date=end_date,
            derived=True,
            derivation="IDENTITY",
            source="ECB",
            points=[],
        )

    if base == "EUR":
        rows = _fetch_eur_series(
            db, quote_currency=quote, start_date=start_date, end_date=end_date
        )
        return FxTimeseries(
            base_currency=base,
            quote_currency=quote,
            start_date=start_date,
            end_date=end_date,
            derived=False,
            derivation="DIRECT",
            source=rows[0].source if rows else "ECB",
            points=[
                FxTimeseriesPoint(effective_date=r.effective_date, rate=Decimal(str(r.rate)))
                for r in rows
            ],
        )

    if quote == "EUR":
        rows = _fetch_eur_series(
            db, quote_currency=base, start_date=start_date, end_date=end_date
        )
        return FxTimeseries(
            base_currency=base,
            quote_currency=quote,
            start_date=start_date,
            end_date=end_date,
            derived=True,
            derivation="INVERT(EUR->BASE)",
            source=rows[0].source if rows else "ECB",
            points=[
                FxTimeseriesPoint(
                    effective_date=r.effective_date,
                    rate=Decimal("1") / Decimal(str(r.rate)),
                )
                for r in rows
            ],
        )

    base_rows = _fetch_eur_series(
        db, quote_currency=base, start_date=start_date, end_date=end_date
    )
    quote_rows = _fetch_eur_series(
        db, quote_currency=quote, start_date=start_date, end_date=end_date
    )

    base_by_date = {r.effective_date: Decimal(str(r.rate)) for r in base_rows}
    quote_by_date = {r.effective_date: Decimal(str(r.rate)) for r in quote_rows}

    # Seed each leg with the most recent value strictly before start_date so the series
    # can start from the very first union date even if only one leg has an update on it.
    seed_base = db.scalar(
        select(FxRate)
        .where(
            FxRate.base_currency == "EUR",
            FxRate.quote_currency == base,
            FxRate.effective_date < start_date,
        )
        .order_by(FxRate.effective_date.desc())
        .limit(1)
    )
    seed_quote = db.scalar(
        select(FxRate)
        .where(
            FxRate.base_currency == "EUR",
            FxRate.quote_currency == quote,
            FxRate.effective_date < start_date,
        )
        .order_by(FxRate.effective_date.desc())
        .limit(1)
    )

    current_base: Decimal | None = Decimal(str(seed_base.rate)) if seed_base else None
    current_quote: Decimal | None = Decimal(str(seed_quote.rate)) if seed_quote else None

    union_dates = sorted(set(base_by_date) | set(quote_by_date))
    source = (
        quote_rows[0].source
        if quote_rows
        else (base_rows[0].source if base_rows else "ECB")
    )

    points: list[FxTimeseriesPoint] = []
    for d in union_dates:
        if d in base_by_date:
            current_base = base_by_date[d]
        if d in quote_by_date:
            current_quote = quote_by_date[d]
        if current_base is None or current_quote is None:
            continue
        rate = current_quote / current_base
        points.append(FxTimeseriesPoint(effective_date=d, rate=rate))

    return FxTimeseries(
        base_currency=base,
        quote_currency=quote,
        start_date=start_date,
        end_date=end_date,
        derived=True,
        derivation="CROSS((EUR->QUOTE)/(EUR->BASE))",
        source=source,
        points=points,
    )

