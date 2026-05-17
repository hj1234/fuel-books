from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.api.deps import require_internal_job_token
from app.db.session import get_db
from app.models.fx_rate import FxRate
from app.services.ecb_fx import fetch_ecb_hist_rates

router = APIRouter(prefix="/internal/jobs", tags=["internal-jobs"])


def _upsert_fx_rate_sqlite(db: Session, *, effective_date: date, quote_currency: str, rate: Decimal) -> None:
    stmt = sqlite_insert(FxRate).values(
        effective_date=effective_date,
        base_currency="EUR",
        quote_currency=quote_currency,
        rate=rate,
        source="ECB",
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["effective_date", "base_currency", "quote_currency"],
        set_={"rate": rate, "source": "ECB"},
    )
    db.execute(stmt)


@router.post("/fx-sync", dependencies=[Depends(require_internal_job_token)])
async def fx_sync(db: Session = Depends(get_db)) -> dict[str, int]:
    rates = await fetch_ecb_hist_rates()
    latest_date = db.scalar(select(FxRate.effective_date).order_by(FxRate.effective_date.desc()).limit(1))
    inserted = 0
    for r in rates:
        if latest_date and r.effective_date <= latest_date:
            continue
        _upsert_fx_rate_sqlite(db, effective_date=r.effective_date, quote_currency=r.quote_currency, rate=r.rate)
        inserted += 1
    db.commit()
    return {"inserted": inserted}


@router.post("/fx-backfill", dependencies=[Depends(require_internal_job_token)])
async def fx_backfill(db: Session = Depends(get_db)) -> dict[str, int]:
    rates = await fetch_ecb_hist_rates()
    inserted = 0
    for r in rates:
        _upsert_fx_rate_sqlite(db, effective_date=r.effective_date, quote_currency=r.quote_currency, rate=r.rate)
        inserted += 1
    db.commit()
    return {"upserted": inserted}

