from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_aircraft_roles, resolve_aircraft_by_public_id
from app.db.session import get_db
from app.models.aircraft import Aircraft
from app.models.aircraft_membership import AircraftMembership, MembershipRole, MembershipStatus
from app.models.user import User
from app.schemas.membership import MembershipCreate, MembershipOut, MembershipUpdate

router = APIRouter(tags=["memberships"])


def _to_out(m: AircraftMembership, *, aircraft_public_id: str, user_email: str | None) -> MembershipOut:
    return MembershipOut(
        id=m.public_id,
        aircraft_id=aircraft_public_id,
        user_email=user_email,
        invited_email=m.invited_email,
        role=m.role.value,
        status=m.status.value,
        invited_at=m.invited_at,
        accepted_at=m.accepted_at,
    )


def _build_outs(db: Session, memberships: list[AircraftMembership], aircraft_public_id: str) -> list[MembershipOut]:
    """Bulk-resolve the linked user emails for a set of memberships (avoids N+1)."""
    user_ids = {m.user_id for m in memberships if m.user_id is not None}
    user_email_by_id: dict[int, str | None] = {}
    if user_ids:
        for user_id, email in db.execute(
            select(User.id, User.email).where(User.id.in_(user_ids))
        ).all():
            user_email_by_id[int(user_id)] = email
    return [
        _to_out(
            m,
            aircraft_public_id=aircraft_public_id,
            user_email=user_email_by_id.get(m.user_id) if m.user_id is not None else None,
        )
        for m in memberships
    ]


def _require_admin_for_aircraft_pk(db: Session, *, aircraft_pk: int, current_user_id: int) -> None:
    m = db.scalar(
        select(AircraftMembership).where(
            AircraftMembership.aircraft_id == aircraft_pk,
            AircraftMembership.user_id == current_user_id,
            AircraftMembership.status == MembershipStatus.ACTIVE,
        )
    )
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aircraft not found")
    if m.role != MembershipRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role for aircraft")


@router.get("/v1/aircraft/{aircraft_id}/memberships", response_model=list[MembershipOut])
def list_memberships(
    aircraft_id: str,
    db: Session = Depends(get_db),
    _membership: AircraftMembership = Depends(require_aircraft_roles(MembershipRole.ADMIN)),
) -> list[MembershipOut]:
    aircraft = resolve_aircraft_by_public_id(db, aircraft_id)
    rows = list(
        db.scalars(
            select(AircraftMembership)
            .where(AircraftMembership.aircraft_id == aircraft.id)
            .order_by(AircraftMembership.id)
        ).all()
    )
    return _build_outs(db, rows, aircraft.public_id)


@router.post("/v1/aircraft/{aircraft_id}/memberships", response_model=MembershipOut, status_code=status.HTTP_201_CREATED)
def create_membership(
    aircraft_id: str,
    payload: MembershipCreate,
    db: Session = Depends(get_db),
    _membership: AircraftMembership = Depends(require_aircraft_roles(MembershipRole.ADMIN)),
) -> MembershipOut:
    aircraft = resolve_aircraft_by_public_id(db, aircraft_id)
    role = MembershipRole(payload.role)

    m = AircraftMembership(
        aircraft_id=aircraft.id,
        user_id=None,
        invited_email=str(payload.invited_email).lower(),
        role=role,
        status=MembershipStatus.INVITED,
        accepted_at=None,
    )
    db.add(m)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Membership already exists")
    db.refresh(m)
    return _to_out(m, aircraft_public_id=aircraft.public_id, user_email=None)


@router.patch("/v1/memberships/{membership_id}", response_model=MembershipOut)
def update_membership(
    membership_id: str,
    payload: MembershipUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MembershipOut:
    m = db.scalar(select(AircraftMembership).where(AircraftMembership.public_id == membership_id))
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found")

    _require_admin_for_aircraft_pk(db, aircraft_pk=m.aircraft_id, current_user_id=current_user.id)

    if payload.role is not None:
        m.role = MembershipRole(payload.role)
    if payload.status is not None:
        m.status = MembershipStatus(payload.status)

    db.commit()
    db.refresh(m)

    # Re-resolve the aircraft public id and any linked user email for the response.
    aircraft = db.scalar(select(Aircraft).where(Aircraft.id == m.aircraft_id))
    assert aircraft is not None  # FK guarantees this
    user_email: str | None = None
    if m.user_id is not None:
        user_email = db.scalar(select(User.email).where(User.id == m.user_id))
    return _to_out(m, aircraft_public_id=aircraft.public_id, user_email=user_email)
