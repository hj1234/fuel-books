from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, resolve_aircraft_by_public_id
from app.db.session import get_db
from app.models.aircraft import Aircraft
from app.models.aircraft_membership import AircraftMembership, MembershipRole, MembershipStatus
from app.models.aircraft_fuel_policy import AircraftFuelPolicy
from app.models.fuel_benchmark_price import FuelBenchmarkPrice
from app.models.fuel_policy import FuelPolicy
from app.models.user import User
from app.schemas.benchmark import BenchmarkAircraftCandidateOut, BenchmarkPriceCreate, BenchmarkPriceOut

router = APIRouter(prefix="/v1/benchmark-prices", tags=["benchmark-prices"])


def _to_out(row: FuelBenchmarkPrice, policy_public_id: str) -> BenchmarkPriceOut:
    return BenchmarkPriceOut(
        id=row.public_id,
        policy_id=policy_public_id,
        airfield_code=row.airfield_code,
        effective_from=row.effective_from,
        fuel_type=row.fuel_type,
        price_per_unit=float(row.price_per_unit),
        unit=row.unit,
        currency=row.currency,
        includes_vat=row.includes_vat,
        vat_rate=float(row.vat_rate),
    )


def _admin_policy_or_404(db: Session, *, policy_public_id: str, user_id: int) -> FuelPolicy:
    """Look up a FuelPolicy by public_id, only if `user_id` administers an aircraft using it."""
    policy = db.scalar(
        select(FuelPolicy)
        .join(AircraftFuelPolicy, AircraftFuelPolicy.fuel_policy_id == FuelPolicy.id)
        .join(Aircraft, AircraftFuelPolicy.aircraft_id == Aircraft.id)
        .join(AircraftMembership, AircraftMembership.aircraft_id == Aircraft.id)
        .where(
            FuelPolicy.public_id == policy_public_id,
            AircraftMembership.user_id == user_id,
            AircraftMembership.status == MembershipStatus.ACTIVE,
            AircraftMembership.role == MembershipRole.ADMIN,
        )
    )
    if not policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found")
    return policy


@router.get("/aircraft-candidates", response_model=list[BenchmarkAircraftCandidateOut])
def list_benchmark_aircraft_candidates(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[BenchmarkAircraftCandidateOut]:
    """Every aircraft you administer (ACTIVE ADMIN); fuel policy id optional via LEFT JOIN."""
    rows = db.execute(
        select(
            Aircraft.public_id,
            Aircraft.registration,
            Aircraft.home_base_airfield,
            FuelPolicy.public_id,
            FuelPolicy.base_currency,
        )
        .join(AircraftMembership, AircraftMembership.aircraft_id == Aircraft.id)
        .outerjoin(AircraftFuelPolicy, AircraftFuelPolicy.aircraft_id == Aircraft.id)
        .outerjoin(FuelPolicy, FuelPolicy.id == AircraftFuelPolicy.fuel_policy_id)
        .where(
            AircraftMembership.user_id == user.id,
            AircraftMembership.status == MembershipStatus.ACTIVE,
            AircraftMembership.role == MembershipRole.ADMIN,
        )
        .order_by(Aircraft.registration.asc())
    ).all()

    return [
        BenchmarkAircraftCandidateOut(
            aircraft_id=str(aircraft_public_id),
            aircraft_registration=str(registration),
            home_base_airfield=str(home_base) if home_base else None,
            policy_id=str(policy_public_id) if policy_public_id is not None else None,
            base_currency=str(ccy) if ccy is not None else None,
        )
        for aircraft_public_id, registration, home_base, policy_public_id, ccy in rows
    ]


@router.get("", response_model=list[BenchmarkPriceOut])
def list_benchmark_prices(
    aircraft_id: str | None = Query(default=None),
    policy_id: str | None = Query(default=None),
    airfield_code: str | None = Query(default=None),
    effective_from_gte: date | None = Query(default=None),
    effective_from_lte: date | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[BenchmarkPriceOut]:
    # Access: only allow access to benchmark prices for policies attached to
    # aircraft where the user has an ACTIVE membership.
    stmt = (
        select(FuelBenchmarkPrice, FuelPolicy.public_id)
        .join(FuelPolicy, FuelBenchmarkPrice.policy_id == FuelPolicy.id)
        .join(AircraftFuelPolicy, AircraftFuelPolicy.fuel_policy_id == FuelPolicy.id)
        .join(Aircraft, AircraftFuelPolicy.aircraft_id == Aircraft.id)
        .join(AircraftMembership, AircraftMembership.aircraft_id == Aircraft.id)
        .where(
            AircraftMembership.user_id == user.id,
            AircraftMembership.status == MembershipStatus.ACTIVE,
        )
    )

    if aircraft_id is not None:
        stmt = stmt.where(Aircraft.public_id == aircraft_id)
    if policy_id is not None:
        stmt = stmt.where(FuelPolicy.public_id == policy_id)
    if airfield_code:
        stmt = stmt.where(FuelBenchmarkPrice.airfield_code == airfield_code.upper())
    if effective_from_gte:
        stmt = stmt.where(FuelBenchmarkPrice.effective_from >= effective_from_gte)
    if effective_from_lte:
        stmt = stmt.where(FuelBenchmarkPrice.effective_from <= effective_from_lte)

    rows = db.execute(
        stmt.order_by(FuelBenchmarkPrice.policy_id, FuelBenchmarkPrice.airfield_code, FuelBenchmarkPrice.effective_from)
    ).all()
    return [_to_out(row, str(policy_public_id)) for row, policy_public_id in rows]


@router.post("", response_model=BenchmarkPriceOut, status_code=status.HTTP_201_CREATED)
def create_benchmark_price(
    payload: BenchmarkPriceCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> BenchmarkPriceOut:
    policy = _admin_policy_or_404(db, policy_public_id=payload.policy_id, user_id=user.id)

    row = FuelBenchmarkPrice(
        policy_id=policy.id,
        airfield_code=payload.airfield_code.upper(),
        effective_from=payload.effective_from,
        fuel_type=payload.fuel_type,
        price_per_unit=payload.price_per_unit,
        unit=payload.unit,
        currency=payload.currency.upper(),
        includes_vat=payload.includes_vat,
        vat_rate=payload.vat_rate,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_out(row, policy.public_id)


def _benchmark_by_public_id_or_404(db: Session, benchmark_public_id: str) -> FuelBenchmarkPrice:
    row = db.scalar(select(FuelBenchmarkPrice).where(FuelBenchmarkPrice.public_id == benchmark_public_id))
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Benchmark price not found")
    return row


def _require_admin_on_policy_pk(db: Session, *, policy_pk: int, user_id: int) -> None:
    owns = db.scalar(
        select(FuelPolicy.id)
        .join(AircraftFuelPolicy, AircraftFuelPolicy.fuel_policy_id == FuelPolicy.id)
        .join(Aircraft, AircraftFuelPolicy.aircraft_id == Aircraft.id)
        .join(AircraftMembership, AircraftMembership.aircraft_id == Aircraft.id)
        .where(
            FuelPolicy.id == policy_pk,
            AircraftMembership.user_id == user_id,
            AircraftMembership.status == MembershipStatus.ACTIVE,
            AircraftMembership.role == MembershipRole.ADMIN,
        )
    )
    if not owns:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Benchmark price not found")


@router.patch("/{benchmark_price_id}", response_model=BenchmarkPriceOut)
def update_benchmark_price(
    benchmark_price_id: str,
    payload: BenchmarkPriceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BenchmarkPriceOut:
    row = _benchmark_by_public_id_or_404(db, benchmark_price_id)

    _require_admin_on_policy_pk(db, policy_pk=row.policy_id, user_id=user.id)

    # Ensure the new policy (if changed) is also administered by the caller.
    new_policy = _admin_policy_or_404(db, policy_public_id=payload.policy_id, user_id=user.id)

    row.policy_id = new_policy.id
    row.airfield_code = payload.airfield_code.upper()
    row.effective_from = payload.effective_from
    row.fuel_type = payload.fuel_type
    row.price_per_unit = payload.price_per_unit
    row.unit = payload.unit
    row.currency = payload.currency.upper()
    row.includes_vat = payload.includes_vat
    row.vat_rate = payload.vat_rate
    db.commit()
    db.refresh(row)
    return _to_out(row, new_policy.public_id)


@router.delete("/{benchmark_price_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_benchmark_price(
    benchmark_price_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    row = _benchmark_by_public_id_or_404(db, benchmark_price_id)
    _require_admin_on_policy_pk(db, policy_pk=row.policy_id, user_id=user.id)
    db.delete(row)
    db.commit()
