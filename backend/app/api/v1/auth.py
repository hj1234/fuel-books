from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.v1.auth_email import issue_initial_verify_token
from app.core.config import settings
from app.core.rate_limit import email_key_from_form, email_key_from_json, limiter
from app.core.security import as_utc, create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, MeResponse, RegisterRequest, TokenResponse

router = APIRouter(prefix="/v1/auth", tags=["auth"])


_INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
)


def _authenticate(db: Session, *, email: str, password: str) -> User:
    """Validate credentials, applying lockout. Always raises 401 on failure to avoid enumeration."""
    user = db.scalar(select(User).where(User.email == email.lower()))
    now = datetime.now(UTC)

    if not user or not user.can_login or not user.password_hash:
        raise _INVALID_CREDENTIALS

    if user.locked_until is not None and as_utc(user.locked_until) > now:
        # Same response shape as a wrong password; we don't tell attackers
        # whether the account is locked vs. password is wrong.
        raise _INVALID_CREDENTIALS

    if not verify_password(password, user.password_hash):
        user.failed_login_count = (user.failed_login_count or 0) + 1
        if user.failed_login_count >= settings.max_failed_logins:
            user.locked_until = now + timedelta(minutes=settings.lockout_minutes)
        db.commit()
        raise _INVALID_CREDENTIALS

    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = now
    db.commit()
    db.refresh(user)
    return user


@router.post("/register", response_model=MeResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)) -> MeResponse:
    user = User(
        email=str(payload.email).lower(),
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        can_login=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    db.refresh(user)

    # Kick off email verification but don't block login on it: users get a
    # working session immediately and we encourage verification in the UI.
    forwarded = request.headers.get("x-forwarded-for")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else None)
    issue_initial_verify_token(db, user=user, ip=ip)

    return MeResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        email_verified_at=user.email_verified_at,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
@limiter.limit("5/minute", key_func=email_key_from_form)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> TokenResponse:
    """OAuth2 password-flow login used by Swagger's Authorize dialog.

    Expects application/x-www-form-urlencoded with fields: username, password.
    """
    user = _authenticate(db, email=form_data.username, password=form_data.password)
    token = create_access_token(subject=str(user.id))
    return TokenResponse(access_token=token)


@router.post("/login-json", response_model=TokenResponse)
@limiter.limit("10/minute")
@limiter.limit("5/minute", key_func=email_key_from_json)
def login_json(
    request: Request,
    payload: LoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """JSON login endpoint for simple clients/curl."""
    user = _authenticate(db, email=str(payload.email), password=payload.password)
    token = create_access_token(subject=str(user.id))
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user)) -> MeResponse:
    return MeResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        email_verified_at=current_user.email_verified_at,
    )

