from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.fx_rate import FxRate
from app.schemas.fx import FxQuoteOut, FxRateOut, FxTimeseriesOut, FxTimeseriesPoint
from app.services.fx import list_available_currencies, quote_fx, quote_fx_timeseries

router = APIRouter(prefix="/v1/fx-rates", tags=["fx-rates"])


@router.get("/currencies", response_model=list[str])
def get_available_currencies(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[str]:
    """Distinct currency codes available in the FX rates store."""
    return list_available_currencies(db)


@router.get("", response_model=list[FxRateOut])
def list_fx_rates(
    base_currency: str | None = Query(default=None),
    quote_currency: str | None = Query(default=None),
    date_gte: date | None = Query(default=None),
    date_lte: date | None = Query(default=None),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[FxRateOut]:
    stmt = select(FxRate)
    if base_currency:
        stmt = stmt.where(FxRate.base_currency == base_currency.upper())
    if quote_currency:
        stmt = stmt.where(FxRate.quote_currency == quote_currency.upper())
    if date_gte:
        stmt = stmt.where(FxRate.effective_date >= date_gte)
    if date_lte:
        stmt = stmt.where(FxRate.effective_date <= date_lte)

    rows = db.scalars(stmt.order_by(FxRate.effective_date.desc(), FxRate.quote_currency)).all()
    return [
        FxRateOut(
            id=r.id,
            effective_date=r.effective_date,
            base_currency=r.base_currency,
            quote_currency=r.quote_currency,
            rate=float(r.rate),
            source=r.source,
        )
        for r in rows
    ]


@router.get("/quote", response_model=FxQuoteOut)
def get_fx_quote(
    base_currency: str = Query(min_length=3, max_length=3),
    quote_currency: str = Query(min_length=3, max_length=3),
    on_date: date = Query(alias="date"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> FxQuoteOut:
    """
    Intelligent FX quote endpoint.

    Examples:
    - Request GBP->EUR: if only EUR->GBP is stored, returns 1/(EUR->GBP)
    - Request GBP->CHF: returns (EUR->CHF)/(EUR->GBP) using a common effective date <= requested date
    """
    try:
        q = quote_fx(db, base_currency=base_currency, quote_currency=quote_currency, on_date=on_date)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return FxQuoteOut(
        effective_date=q.effective_date,
        base_currency=q.base_currency,
        quote_currency=q.quote_currency,
        rate=float(q.rate),
        source=q.source,
        derived=q.derived,
        derivation=q.derivation,
    )


@router.get("/timeseries", response_model=FxTimeseriesOut)
def get_fx_timeseries(
    base_currency: str = Query(min_length=3, max_length=3),
    quote_currency: str = Query(min_length=3, max_length=3),
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> FxTimeseriesOut:
    """
    Return a daily-resolution FX timeseries for the given currency pair and date range.
    Derives cross-rates via EUR when the pair isn't stored directly.
    """
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must be on or after start_date",
        )

    try:
        ts = quote_fx_timeseries(
            db,
            base_currency=base_currency,
            quote_currency=quote_currency,
            start_date=start_date,
            end_date=end_date,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    return FxTimeseriesOut(
        base_currency=ts.base_currency,
        quote_currency=ts.quote_currency,
        start_date=ts.start_date,
        end_date=ts.end_date,
        derived=ts.derived,
        derivation=ts.derivation,
        source=ts.source,
        points=[
            FxTimeseriesPoint(effective_date=p.effective_date, rate=float(p.rate))
            for p in ts.points
        ],
    )

