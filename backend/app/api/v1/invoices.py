from __future__ import annotations

from datetime import datetime, time, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_aircraft_roles, resolve_aircraft_by_public_id
from app.db.session import get_db
from app.models.aircraft import Aircraft
from app.models.aircraft_membership import AircraftMembership, MembershipRole
from app.models.fuel_expense import FuelExpense
from app.models.fuel_expense_calculation import FuelExpenseCalculation
from app.models.pilot import Pilot
from app.services.invoices import (
    InvoiceAircraft,
    InvoicePilot,
    PilotInvoiceLine,
    build_pilot_invoice,
    build_zip,
    parse_month,
    render_pilot_invoice_pdf,
    slugify,
)


router = APIRouter(tags=["invoices"])


def _parse_month_or_422(month: str) -> tuple[datetime, datetime]:
    """Validate month and return UTC datetime bounds for `purchased_at < end`."""
    try:
        start_d, end_d = parse_month(month)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid month")
    start = datetime.combine(start_d, time.min, tzinfo=timezone.utc)
    end = datetime.combine(end_d, time.min, tzinfo=timezone.utc)
    return start, end


def _latest_calculation(db: Session, expense_id: int) -> FuelExpenseCalculation | None:
    return db.scalar(
        select(FuelExpenseCalculation)
        .where(FuelExpenseCalculation.fuel_expense_id == expense_id)
        .order_by(FuelExpenseCalculation.id.desc())
        .limit(1)
    )


def _expense_to_line(db: Session, expense: FuelExpense) -> PilotInvoiceLine:
    calc = _latest_calculation(db, expense.id)
    return PilotInvoiceLine(
        purchased_at=expense.purchased_at,
        airfield_code=expense.airfield_code,
        vendor=expense.vendor,
        volume=Decimal(str(expense.volume)),
        unit=expense.unit,
        total_amount=Decimal(str(expense.total_amount)),
        currency=expense.currency,
        refund_amount=Decimal(str(calc.refund_amount)) if calc else None,
        refund_currency=calc.refund_currency if calc else None,
    )


def _to_invoice_aircraft(a: Aircraft) -> InvoiceAircraft:
    return InvoiceAircraft(registration=a.registration, make=a.make, model=a.model)


def _to_invoice_pilot(p: Pilot) -> InvoicePilot:
    return InvoicePilot(name=p.name, email=p.email)


@router.get("/v1/aircraft/{aircraft_id}/invoices/pilots")
def list_invoice_summaries(
    aircraft_id: str,
    month: str = Query(min_length=7, max_length=7, description="YYYY-MM"),
    db: Session = Depends(get_db),
    _membership: AircraftMembership = Depends(
        require_aircraft_roles(MembershipRole.ADMIN, MembershipRole.PILOT)
    ),
) -> dict:
    start, end = _parse_month_or_422(month)
    aircraft = resolve_aircraft_by_public_id(db, aircraft_id)

    expenses = db.scalars(
        select(FuelExpense)
        .where(
            FuelExpense.aircraft_id == aircraft.id,
            FuelExpense.purchased_at >= start,
            FuelExpense.purchased_at < end,
        )
        .order_by(FuelExpense.purchased_at)
    ).all()

    pilots = {
        p.id: p
        for p in db.scalars(select(Pilot).where(Pilot.aircraft_id == aircraft.id)).all()
    }

    by_pilot: dict[int, dict] = {}
    unassigned = 0
    for e in expenses:
        if e.pilot_id is None or e.pilot_id not in pilots:
            unassigned += 1
            continue
        pilot = pilots[e.pilot_id]
        bucket = by_pilot.setdefault(
            e.pilot_id,
            {
                # Expose the pilot's UUID so the frontend can build URLs
                # (e.g. invoice PDF download) without ever seeing internal ids.
                "pilot_id": pilot.public_id,
                "pilot_name": pilot.name,
                "pilot_email": pilot.email,
                "expense_count": 0,
                "totals_spent": {},
                "totals_refund": {},
            },
        )
        bucket["expense_count"] += 1
        spent = bucket["totals_spent"]
        spent[e.currency] = float(Decimal(str(spent.get(e.currency, 0))) + Decimal(str(e.total_amount)))
        calc = _latest_calculation(db, e.id)
        if calc:
            ref = bucket["totals_refund"]
            ref[calc.refund_currency] = float(
                Decimal(str(ref.get(calc.refund_currency, 0))) + Decimal(str(calc.refund_amount))
            )

    pilot_summaries = sorted(by_pilot.values(), key=lambda b: b["pilot_name"].lower())

    return {
        "month": month,
        "pilots": pilot_summaries,
        "unassigned_expense_count": unassigned,
    }


def _generate_pilot_pdf(
    db: Session,
    *,
    aircraft: Aircraft,
    pilot: Pilot,
    start: datetime,
    end: datetime,
) -> bytes | None:
    expenses = db.scalars(
        select(FuelExpense)
        .where(
            FuelExpense.aircraft_id == aircraft.id,
            FuelExpense.pilot_id == pilot.id,
            FuelExpense.purchased_at >= start,
            FuelExpense.purchased_at < end,
        )
        .order_by(FuelExpense.purchased_at)
    ).all()
    if not expenses:
        return None

    lines = [_expense_to_line(db, e) for e in expenses]
    invoice = build_pilot_invoice(
        aircraft=_to_invoice_aircraft(aircraft),
        pilot=_to_invoice_pilot(pilot),
        period_start=start.date(),
        period_end_exclusive=end.date(),
        lines=lines,
    )
    return render_pilot_invoice_pdf(invoice)


@router.get("/v1/aircraft/{aircraft_id}/invoices/pilot/{pilot_id}.pdf")
def get_pilot_invoice_pdf(
    aircraft_id: str,
    pilot_id: str,
    month: str = Query(min_length=7, max_length=7, description="YYYY-MM"),
    db: Session = Depends(get_db),
    _membership: AircraftMembership = Depends(
        require_aircraft_roles(MembershipRole.ADMIN, MembershipRole.PILOT)
    ),
) -> Response:
    start, end = _parse_month_or_422(month)
    aircraft = resolve_aircraft_by_public_id(db, aircraft_id)

    pilot = db.scalar(
        select(Pilot).where(Pilot.public_id == pilot_id, Pilot.aircraft_id == aircraft.id)
    )
    if not pilot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pilot not found")

    pdf = _generate_pilot_pdf(db, aircraft=aircraft, pilot=pilot, start=start, end=end)
    if pdf is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No expenses for this pilot in the period"
        )

    filename = f"invoice-{slugify(aircraft.registration)}-{slugify(pilot.name)}-{month}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"content-disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/v1/aircraft/{aircraft_id}/invoices.zip")
def get_invoices_zip(
    aircraft_id: str,
    month: str = Query(min_length=7, max_length=7, description="YYYY-MM"),
    db: Session = Depends(get_db),
    _membership: AircraftMembership = Depends(
        require_aircraft_roles(MembershipRole.ADMIN, MembershipRole.PILOT)
    ),
) -> Response:
    start, end = _parse_month_or_422(month)
    aircraft = resolve_aircraft_by_public_id(db, aircraft_id)

    pilot_ids_with_expenses = db.scalars(
        select(FuelExpense.pilot_id)
        .where(
            FuelExpense.aircraft_id == aircraft.id,
            FuelExpense.purchased_at >= start,
            FuelExpense.purchased_at < end,
            FuelExpense.pilot_id.is_not(None),
        )
        .group_by(FuelExpense.pilot_id)
    ).all()

    if not pilot_ids_with_expenses:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No invoiceable expenses for this period"
        )

    pilots = db.scalars(
        select(Pilot)
        .where(Pilot.aircraft_id == aircraft.id, Pilot.id.in_(pilot_ids_with_expenses))
        .order_by(Pilot.name)
    ).all()

    files: list[tuple[str, bytes]] = []
    for pilot in pilots:
        pdf = _generate_pilot_pdf(db, aircraft=aircraft, pilot=pilot, start=start, end=end)
        if pdf is None:
            continue
        filename = f"invoice-{slugify(aircraft.registration)}-{slugify(pilot.name)}-{month}.pdf"
        files.append((filename, pdf))

    if not files:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No invoiceable expenses for this period"
        )

    zip_bytes = build_zip(files)
    zip_filename = f"invoices-{slugify(aircraft.registration)}-{month}.zip"
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"content-disposition": f'attachment; filename="{zip_filename}"'},
    )
