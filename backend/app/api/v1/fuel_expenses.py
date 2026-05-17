from __future__ import annotations

from datetime import date, datetime, time
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, resolve_aircraft_by_public_id
from app.db.session import get_db
from app.models.aircraft import Aircraft
from app.models.aircraft_membership import AircraftMembership, MembershipRole, MembershipStatus
from app.models.fuel_expense import FuelExpense
from app.models.fuel_expense_calculation import FuelExpenseCalculation
from app.models.pilot import Pilot
from app.models.user import User
from app.schemas.expense import (
    FuelExpenseCalculationOut,
    FuelExpenseCreate,
    FuelExpenseListOut,
    FuelExpenseRefundPreviewOut,
    FuelExpenseOut,
    FuelExpenseUpdate,
)
from app.services.refunds import calculate_refund_detailed

router = APIRouter(tags=["fuel-expenses"])


def _require_membership(
    db: Session, *, aircraft_pk: int, user_id: int, roles: set[MembershipRole]
) -> AircraftMembership:
    membership = db.scalar(
        select(AircraftMembership).where(
            AircraftMembership.aircraft_id == aircraft_pk,
            AircraftMembership.user_id == user_id,
            AircraftMembership.status == MembershipStatus.ACTIVE,
        )
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aircraft not found")
    if membership.role not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role for aircraft")
    return membership


def _resolve_pilot_pk(db: Session, *, aircraft_pk: int, pilot_public_id: str | None) -> int | None:
    """Translate an incoming pilot UUID to its internal id, scoped to this aircraft.

    A missing or unknown UUID raises 422 so the client doesn't silently end up
    with no pilot attached when they meant to set one.
    """
    if pilot_public_id is None:
        return None
    pilot_pk = db.scalar(
        select(Pilot.id).where(Pilot.public_id == pilot_public_id, Pilot.aircraft_id == aircraft_pk)
    )
    if pilot_pk is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Pilot not found")
    return int(pilot_pk)


def _expense_to_out(
    db: Session,
    expense: FuelExpense,
    *,
    aircraft_public_id: str,
    pilot_public_id_by_pk: dict[int, str],
    include_calculation_details: bool = False,
) -> FuelExpenseOut:
    latest = db.scalar(
        select(FuelExpenseCalculation)
        .where(FuelExpenseCalculation.fuel_expense_id == expense.id)
        .order_by(FuelExpenseCalculation.id.desc())
        .limit(1)
    )
    latest_out = None
    if latest:
        details = None
        if include_calculation_details:
            details = latest.details_snapshot
        latest_out = FuelExpenseCalculationOut(
            id=latest.id,
            created_at=latest.created_at,
            effective_date=latest.effective_date,
            refund_amount=float(latest.refund_amount),
            refund_currency=latest.refund_currency,
            derivation=latest.derivation,
            explanation=latest.explanation,
            details=details,
        )

    pilot_public_id: str | None = None
    if expense.pilot_id is not None:
        pilot_public_id = pilot_public_id_by_pk.get(expense.pilot_id)

    return FuelExpenseOut(
        id=expense.public_id,
        aircraft_id=aircraft_public_id,
        pilot_id=pilot_public_id,
        purchased_at=expense.purchased_at,
        country_code=expense.country_code,
        airfield_code=expense.airfield_code,
        vendor=expense.vendor,
        volume=float(expense.volume),
        unit=expense.unit,
        total_amount=float(expense.total_amount),
        currency=expense.currency,
        vat_amount=float(expense.vat_amount) if expense.vat_amount is not None else None,
        notes=expense.notes,
        latest_calculation=latest_out,
    )


def _pilot_public_id_map(db: Session, *, aircraft_pk: int) -> dict[int, str]:
    """Build a {pilot.id: pilot.public_id} map for the aircraft's pilots."""
    rows = db.execute(
        select(Pilot.id, Pilot.public_id).where(Pilot.aircraft_id == aircraft_pk)
    ).all()
    return {int(pid): str(public) for pid, public in rows}


_SORT_COLUMNS = {
    "purchased_at": FuelExpense.purchased_at,
    "total_amount": FuelExpense.total_amount,
    "volume": FuelExpense.volume,
    "country_code": FuelExpense.country_code,
    "pilot_name": Pilot.name,
}

SortColumn = Literal["purchased_at", "total_amount", "volume", "country_code", "pilot_name"]
SortDir = Literal["asc", "desc"]


@router.get("/v1/aircraft/{aircraft_id}/fuel-expenses", response_model=FuelExpenseListOut)
def list_expenses(
    aircraft_id: str,
    pilot_id: str | None = Query(default=None),
    date_gte: date | None = Query(default=None),
    date_lte: date | None = Query(default=None),
    sort: SortColumn = Query(default="purchased_at"),
    dir: SortDir = Query(default="desc"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FuelExpenseListOut:
    aircraft = resolve_aircraft_by_public_id(db, aircraft_id)
    _require_membership(
        db,
        aircraft_pk=aircraft.id,
        user_id=current_user.id,
        roles={MembershipRole.ADMIN, MembershipRole.PILOT},
    )

    filters = [FuelExpense.aircraft_id == aircraft.id]
    if pilot_id is not None:
        pilot_pk = _resolve_pilot_pk(db, aircraft_pk=aircraft.id, pilot_public_id=pilot_id)
        filters.append(FuelExpense.pilot_id == pilot_pk)
    if date_gte is not None:
        filters.append(FuelExpense.purchased_at >= datetime.combine(date_gte, time.min))
    if date_lte is not None:
        filters.append(FuelExpense.purchased_at <= datetime.combine(date_lte, time.max))

    sort_col = _SORT_COLUMNS[sort]
    order_clause = sort_col.asc() if dir == "asc" else sort_col.desc()

    items_stmt = select(FuelExpense).where(*filters)
    if sort == "pilot_name":
        items_stmt = items_stmt.outerjoin(Pilot, Pilot.id == FuelExpense.pilot_id)
    # Tiebreaker keeps pagination deterministic when the sort column has duplicates.
    items_stmt = items_stmt.order_by(order_clause, FuelExpense.id.desc()).limit(limit).offset(offset)

    rows = db.scalars(items_stmt).all()

    total = db.scalar(select(func.count()).select_from(FuelExpense).where(*filters)) or 0

    pilot_map = _pilot_public_id_map(db, aircraft_pk=aircraft.id)
    return FuelExpenseListOut(
        items=[
            _expense_to_out(db, e, aircraft_public_id=aircraft.public_id, pilot_public_id_by_pk=pilot_map)
            for e in rows
        ],
        total=int(total),
        limit=limit,
        offset=offset,
    )


@router.post(
    "/v1/aircraft/{aircraft_id}/fuel-expenses/calculate-and-create",
    response_model=FuelExpenseOut,
    status_code=status.HTTP_201_CREATED,
)
def calculate_and_create(
    aircraft_id: str,
    payload: FuelExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FuelExpenseOut:
    aircraft = resolve_aircraft_by_public_id(db, aircraft_id)
    _require_membership(db, aircraft_pk=aircraft.id, user_id=current_user.id, roles={MembershipRole.ADMIN})

    pilot_pk = _resolve_pilot_pk(db, aircraft_pk=aircraft.id, pilot_public_id=payload.pilot_id)

    expense = FuelExpense(
        aircraft_id=aircraft.id,
        pilot_id=pilot_pk,
        purchased_at=payload.purchased_at,
        country_code=payload.country_code.upper(),
        airfield_code=payload.airfield_code.upper() if payload.airfield_code else None,
        vendor=payload.vendor,
        volume=payload.volume,
        unit=payload.unit.upper(),
        total_amount=payload.total_amount,
        currency=payload.currency.upper(),
        vat_amount=payload.vat_amount,
        notes=payload.notes,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)

    result = calculate_refund_detailed(db, expense=expense)
    calc = FuelExpenseCalculation(
        fuel_expense_id=expense.id,
        effective_date=result.effective_date,
        policy_currency=result.refund_currency,
        refund_amount=result.refund_amount,
        refund_currency=result.refund_currency,
        derivation=result.derivation,
        explanation=result.explanation,
        details_snapshot=result.details,
    )
    db.add(calc)
    db.commit()

    return _expense_to_out(
        db,
        expense,
        aircraft_public_id=aircraft.public_id,
        pilot_public_id_by_pk=_pilot_public_id_map(db, aircraft_pk=aircraft.id),
        include_calculation_details=True,
    )


@router.post("/v1/aircraft/{aircraft_id}/fuel-expenses/calculate", response_model=FuelExpenseRefundPreviewOut)
def calculate_only(
    aircraft_id: str,
    payload: FuelExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FuelExpenseRefundPreviewOut:
    aircraft = resolve_aircraft_by_public_id(db, aircraft_id)
    _require_membership(db, aircraft_pk=aircraft.id, user_id=current_user.id, roles={MembershipRole.ADMIN})

    pilot_pk = _resolve_pilot_pk(db, aircraft_pk=aircraft.id, pilot_public_id=payload.pilot_id)

    # Build an in-memory expense for calculation only (do not persist).
    expense = FuelExpense(
        aircraft_id=aircraft.id,
        pilot_id=pilot_pk,
        purchased_at=payload.purchased_at,
        country_code=payload.country_code.upper(),
        airfield_code=payload.airfield_code.upper() if payload.airfield_code else None,
        vendor=payload.vendor,
        volume=payload.volume,
        unit=payload.unit.upper(),
        total_amount=payload.total_amount,
        currency=payload.currency.upper(),
        vat_amount=payload.vat_amount,
        notes=payload.notes,
    )

    result = calculate_refund_detailed(db, expense=expense)
    return FuelExpenseRefundPreviewOut(
        effective_date=result.effective_date,
        refund_amount=float(result.refund_amount),
        refund_currency=result.refund_currency,
        derivation=result.derivation,
        explanation=result.explanation,
        details=result.details,
    )


def _expense_by_public_id_or_404(db: Session, expense_public_id: str) -> FuelExpense:
    expense = db.scalar(select(FuelExpense).where(FuelExpense.public_id == expense_public_id))
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fuel expense not found")
    return expense


@router.get("/v1/fuel-expenses/{expense_id}", response_model=FuelExpenseOut)
def get_fuel_expense(
    expense_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FuelExpenseOut:
    expense = _expense_by_public_id_or_404(db, expense_id)
    aircraft = db.scalar(select(Aircraft).where(Aircraft.id == expense.aircraft_id))
    if not aircraft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aircraft not found")
    _require_membership(
        db,
        aircraft_pk=aircraft.id,
        user_id=current_user.id,
        roles={MembershipRole.ADMIN, MembershipRole.PILOT},
    )
    return _expense_to_out(
        db,
        expense,
        aircraft_public_id=aircraft.public_id,
        pilot_public_id_by_pk=_pilot_public_id_map(db, aircraft_pk=aircraft.id),
        include_calculation_details=True,
    )


@router.patch("/v1/fuel-expenses/{expense_id}", response_model=FuelExpenseOut)
def update_expense_and_recalculate(
    expense_id: str,
    payload: FuelExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FuelExpenseOut:
    expense = _expense_by_public_id_or_404(db, expense_id)

    aircraft = db.scalar(select(Aircraft).where(Aircraft.id == expense.aircraft_id))
    if not aircraft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aircraft not found")
    _require_membership(db, aircraft_pk=aircraft.id, user_id=current_user.id, roles={MembershipRole.ADMIN})

    if payload.purchased_at is not None:
        expense.purchased_at = payload.purchased_at
    if payload.country_code is not None:
        expense.country_code = payload.country_code.upper()
    if payload.airfield_code is not None:
        expense.airfield_code = payload.airfield_code.upper()
    if payload.vendor is not None:
        expense.vendor = payload.vendor
    if payload.volume is not None:
        expense.volume = payload.volume
    if payload.unit is not None:
        expense.unit = payload.unit.upper()
    if payload.total_amount is not None:
        expense.total_amount = payload.total_amount
    if payload.currency is not None:
        expense.currency = payload.currency.upper()
    if payload.vat_amount is not None:
        expense.vat_amount = payload.vat_amount
    if payload.notes is not None:
        expense.notes = payload.notes
    if payload.pilot_id is not None:
        expense.pilot_id = _resolve_pilot_pk(db, aircraft_pk=aircraft.id, pilot_public_id=payload.pilot_id)

    db.commit()
    db.refresh(expense)

    result = calculate_refund_detailed(db, expense=expense)
    calc = FuelExpenseCalculation(
        fuel_expense_id=expense.id,
        effective_date=result.effective_date,
        policy_currency=result.refund_currency,
        refund_amount=result.refund_amount,
        refund_currency=result.refund_currency,
        derivation=result.derivation,
        explanation=result.explanation,
        details_snapshot=result.details,
    )
    db.add(calc)
    db.commit()

    return _expense_to_out(
        db,
        expense,
        aircraft_public_id=aircraft.public_id,
        pilot_public_id_by_pk=_pilot_public_id_map(db, aircraft_pk=aircraft.id),
        include_calculation_details=True,
    )


@router.delete("/v1/fuel-expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    expense = _expense_by_public_id_or_404(db, expense_id)

    aircraft = db.scalar(select(Aircraft).where(Aircraft.id == expense.aircraft_id))
    if not aircraft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aircraft not found")
    _require_membership(db, aircraft_pk=aircraft.id, user_id=current_user.id, roles={MembershipRole.ADMIN})

    db.delete(expense)
    db.commit()
    return None
