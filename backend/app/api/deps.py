from __future__ import annotations

import uuid

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_token
from app.db.session import get_db
from app.models.aircraft import Aircraft
from app.models.aircraft_membership import AircraftMembership, MembershipRole, MembershipStatus
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/v1/auth/login")


def require_internal_job_token(x_internal_job_token: str | None = Header(default=None)) -> None:
    if not x_internal_job_token or x_internal_job_token != settings.internal_job_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal job token")


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    try:
        payload = decode_token(token)
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user_id = int(sub)
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    # Stash on request.state so per-user rate limiters can key off the user id.
    request.state.current_user = user
    return user


def resolve_aircraft_by_public_id(db: Session, aircraft_id: str) -> Aircraft:
    """Look up an Aircraft by its opaque public_id (UUID).

    Returns a 404 (not 400) for both invalid-format and missing IDs so we don't
    leak whether a particular ID exists.
    """
    try:
        uuid.UUID(aircraft_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aircraft not found")
    aircraft = db.scalar(select(Aircraft).where(Aircraft.public_id == aircraft_id))
    if not aircraft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aircraft not found")
    return aircraft


def get_active_membership(
    aircraft_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> AircraftMembership:
    aircraft = resolve_aircraft_by_public_id(db, aircraft_id)
    membership = db.scalar(
        select(AircraftMembership).where(
            AircraftMembership.aircraft_id == aircraft.id,
            AircraftMembership.user_id == current_user.id,
            AircraftMembership.status == MembershipStatus.ACTIVE,
        )
    )
    if not membership:
        # Avoid leaking which aircraft IDs exist.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aircraft not found")
    return membership


def require_aircraft_roles(*roles: MembershipRole):
    allowed = set(roles)

    def _dep(membership: AircraftMembership = Depends(get_active_membership)) -> AircraftMembership:
        if membership.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role for aircraft")
        return membership

    return _dep
