from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_aircraft_roles, resolve_aircraft_by_public_id
from app.db.session import get_db
from app.models.aircraft_membership import AircraftMembership, MembershipRole, MembershipStatus
from app.models.aircraft import Aircraft
from app.models.user import User
from app.schemas.aircraft import AircraftCreate, AircraftOut, AircraftUpdate

router = APIRouter(prefix="/v1/aircraft", tags=["aircraft"])


def _to_out(a: Aircraft) -> AircraftOut:
    return AircraftOut(
        id=a.public_id,
        registration=a.registration,
        make=a.make,
        model=a.model,
        home_base_airfield=a.home_base_airfield,
    )


@router.get("", response_model=list[AircraftOut])
def list_aircraft(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[AircraftOut]:
    rows = db.scalars(
        select(Aircraft)
        .join(AircraftMembership, AircraftMembership.aircraft_id == Aircraft.id)
        .where(
            AircraftMembership.user_id == current_user.id,
            AircraftMembership.status == MembershipStatus.ACTIVE,
        )
        .order_by(Aircraft.id)
    ).all()
    return [_to_out(a) for a in rows]


@router.post("", response_model=AircraftOut, status_code=status.HTTP_201_CREATED)
def create_aircraft(
    payload: AircraftCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> AircraftOut:
    aircraft = Aircraft(
        owner_user_id=current_user.id,
        registration=payload.registration,
        make=payload.make,
        model=payload.model,
        home_base_airfield=payload.home_base_airfield,
    )
    db.add(aircraft)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Duplicate registration for owner")
    db.refresh(aircraft)

    db.add(
        AircraftMembership(
            aircraft_id=aircraft.id,
            user_id=current_user.id,
            invited_email=None,
            role=MembershipRole.ADMIN,
            status=MembershipStatus.ACTIVE,
            accepted_at=None,
        )
    )
    db.commit()

    return _to_out(aircraft)


@router.get("/{aircraft_id}", response_model=AircraftOut)
def get_aircraft(
    aircraft_id: str,
    db: Session = Depends(get_db),
    _membership: AircraftMembership = Depends(require_aircraft_roles(MembershipRole.ADMIN, MembershipRole.PILOT)),
) -> AircraftOut:
    return _to_out(resolve_aircraft_by_public_id(db, aircraft_id))


@router.patch("/{aircraft_id}", response_model=AircraftOut)
def update_aircraft(
    aircraft_id: str,
    payload: AircraftUpdate,
    db: Session = Depends(get_db),
    _membership: AircraftMembership = Depends(require_aircraft_roles(MembershipRole.ADMIN)),
) -> AircraftOut:
    a = resolve_aircraft_by_public_id(db, aircraft_id)
    if payload.registration is not None:
        a.registration = payload.registration
    if payload.make is not None:
        a.make = payload.make
    if payload.model is not None:
        a.model = payload.model
    if payload.home_base_airfield is not None:
        a.home_base_airfield = payload.home_base_airfield
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Duplicate registration for owner")
    db.refresh(a)
    return _to_out(a)


@router.delete("/{aircraft_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_aircraft(
    aircraft_id: str,
    db: Session = Depends(get_db),
    _membership: AircraftMembership = Depends(require_aircraft_roles(MembershipRole.ADMIN)),
) -> None:
    a = resolve_aircraft_by_public_id(db, aircraft_id)
    db.delete(a)
    db.commit()
