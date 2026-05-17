from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_aircraft_roles, resolve_aircraft_by_public_id
from app.db.session import get_db
from app.models.aircraft import Aircraft
from app.models.aircraft_membership import AircraftMembership, MembershipRole
from app.models.pilot import Pilot
from app.schemas.pilot import PilotCreate, PilotOut

router = APIRouter(tags=["pilots"])


def _to_out(pilot: Pilot, aircraft_public_id: str) -> PilotOut:
    return PilotOut(
        id=pilot.public_id,
        aircraft_id=aircraft_public_id,
        name=pilot.name,
        email=pilot.email,
    )


@router.get("/v1/aircraft/{aircraft_id}/pilots", response_model=list[PilotOut])
def list_pilots(
    aircraft_id: str,
    db: Session = Depends(get_db),
    _membership: AircraftMembership = Depends(require_aircraft_roles(MembershipRole.ADMIN)),
) -> list[PilotOut]:
    aircraft = resolve_aircraft_by_public_id(db, aircraft_id)
    pilots = db.scalars(select(Pilot).where(Pilot.aircraft_id == aircraft.id).order_by(Pilot.id)).all()
    return [_to_out(p, aircraft.public_id) for p in pilots]


@router.post("/v1/aircraft/{aircraft_id}/pilots", response_model=PilotOut, status_code=status.HTTP_201_CREATED)
def create_pilot(
    aircraft_id: str,
    payload: PilotCreate,
    db: Session = Depends(get_db),
    _membership: AircraftMembership = Depends(require_aircraft_roles(MembershipRole.ADMIN)),
) -> PilotOut:
    aircraft = resolve_aircraft_by_public_id(db, aircraft_id)
    pilot = Pilot(aircraft_id=aircraft.id, name=payload.name, email=str(payload.email) if payload.email else None)
    db.add(pilot)
    db.commit()
    db.refresh(pilot)
    return _to_out(pilot, aircraft.public_id)
