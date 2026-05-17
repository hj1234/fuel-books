"""Password management endpoints: change, forgot, reset."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.rate_limit import email_key_from_json, limiter
from app.core.security import (
    as_utc,
    generate_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.db.session import get_db
from app.models.auth_token import AuthToken, AuthTokenPurpose
from app.models.user import User
from app.schemas.auth import (
    PasswordChangeRequest,
    PasswordForgotRequest,
    PasswordResetRequest,
)
from app.services.email import password_reset_email, send_transactional_email


router = APIRouter(prefix="/v1/auth/password", tags=["auth"])


@router.post("/change", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def change_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    if not user.password_hash or not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    if payload.new_password == payload.current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current one",
        )

    now = datetime.now(UTC)
    user.password_hash = hash_password(payload.new_password)
    user.password_changed_at = now
    user.failed_login_count = 0
    user.locked_until = None

    # Invalidate any outstanding password-reset tokens for this user; if they
    # remembered their password, any reset link in their inbox should stop working.
    db.execute(
        delete(AuthToken).where(
            AuthToken.user_id == user.id,
            AuthToken.purpose == AuthTokenPurpose.PASSWORD_RESET,
        )
    )

    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/forgot", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
@limiter.limit("5/minute")
@limiter.limit("3/hour", key_func=email_key_from_json)
def forgot_password(
    request: Request,
    payload: PasswordForgotRequest,
    db: Session = Depends(get_db),
) -> Response:
    """Always returns 204 to avoid leaking which email addresses are registered."""
    email = str(payload.email).lower()
    user = db.scalar(select(User).where(User.email == email))

    if user and user.can_login and user.email:
        # Replace any outstanding reset tokens so only the newest link works.
        db.execute(
            delete(AuthToken).where(
                AuthToken.user_id == user.id,
                AuthToken.purpose == AuthTokenPurpose.PASSWORD_RESET,
            )
        )

        plaintext, digest = generate_token()
        token_row = AuthToken(
            user_id=user.id,
            token_hash=digest,
            purpose=AuthTokenPurpose.PASSWORD_RESET,
            expires_at=datetime.now(UTC) + timedelta(minutes=settings.password_reset_ttl_minutes),
            ip=_client_ip(request),
        )
        db.add(token_row)
        db.commit()

        subject, text = password_reset_email(full_name=user.full_name, token=plaintext)
        send_transactional_email(
            to=user.email, subject=subject, text=text, context="password_reset"
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/reset", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
@limiter.limit("20/minute")
def reset_password(
    request: Request,
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
) -> Response:
    digest = hash_token(payload.token)
    now = datetime.now(UTC)

    token_row = db.scalar(
        select(AuthToken).where(
            AuthToken.token_hash == digest,
            AuthToken.purpose == AuthTokenPurpose.PASSWORD_RESET,
        )
    )
    if not token_row or token_row.used_at is not None or as_utc(token_row.expires_at) <= now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link")

    user = db.get(User, token_row.user_id)
    if not user or not user.can_login:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link")

    user.password_hash = hash_password(payload.new_password)
    user.password_changed_at = now
    user.failed_login_count = 0
    user.locked_until = None

    token_row.used_at = now

    # Burn any other outstanding reset tokens for this user.
    db.execute(
        delete(AuthToken).where(
            AuthToken.user_id == user.id,
            AuthToken.purpose == AuthTokenPurpose.PASSWORD_RESET,
            AuthToken.id != token_row.id,
        )
    )

    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _client_ip(request: Request) -> str | None:
    # Trust the platform's first proxy hop in dev; tighten in prod by setting
    # FastAPI's `proxy_headers` and a real `forwarded_allow_ips`.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None
