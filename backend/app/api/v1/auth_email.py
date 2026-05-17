"""Email management endpoints: verify on signup/re-verify, change address."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.rate_limit import limiter, user_id_key
from app.core.security import as_utc, generate_token, hash_token, verify_password
from app.db.session import get_db
from app.models.auth_token import AuthToken, AuthTokenPurpose
from app.models.user import User
from app.schemas.auth import EmailChangeRequest, EmailVerifyConsumeRequest
from app.services.email import (
    email_change_email,
    send_transactional_email,
    verify_email as verify_email_template,
)


router = APIRouter(prefix="/v1/auth/email", tags=["auth"])


@router.post("/verify/request", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
@limiter.limit("5/hour", key_func=user_id_key)
def request_email_verification(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    if not user.email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No email on account")
    if user.email_verified_at is not None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    _issue_verify_token(db, user=user, ip=_client_ip(request), to=user.email)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/verify", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def consume_email_verification(
    payload: EmailVerifyConsumeRequest,
    db: Session = Depends(get_db),
) -> Response:
    digest = hash_token(payload.token)
    now = datetime.now(UTC)

    token_row = db.scalar(
        select(AuthToken).where(
            AuthToken.token_hash == digest,
            AuthToken.purpose.in_(
                (AuthTokenPurpose.EMAIL_VERIFY, AuthTokenPurpose.EMAIL_CHANGE)
            ),
        )
    )
    if not token_row or token_row.used_at is not None or as_utc(token_row.expires_at) <= now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired link")

    user = db.get(User, token_row.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired link")

    if token_row.purpose == AuthTokenPurpose.EMAIL_CHANGE:
        new_email = (token_row.new_email or "").lower()
        if not new_email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired link")
        user.email = new_email
        # Confirming via a link sent to the new mailbox is itself proof of access.
        user.email_verified_at = now
        token_row.used_at = now
        # Burn other outstanding change/verify tokens; the email is now what they said.
        db.execute(
            delete(AuthToken).where(
                AuthToken.user_id == user.id,
                AuthToken.purpose.in_(
                    (AuthTokenPurpose.EMAIL_CHANGE, AuthTokenPurpose.EMAIL_VERIFY)
                ),
                AuthToken.id != token_row.id,
            )
        )
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Email already in use"
            )
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    # EMAIL_VERIFY (sign-up / resend).
    user.email_verified_at = now
    token_row.used_at = now
    db.execute(
        delete(AuthToken).where(
            AuthToken.user_id == user.id,
            AuthToken.purpose == AuthTokenPurpose.EMAIL_VERIFY,
            AuthToken.id != token_row.id,
        )
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/change/request", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
@limiter.limit("5/hour", key_func=user_id_key)
def request_email_change(
    request: Request,
    payload: EmailChangeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    if not user.password_hash or not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password is incorrect")

    new_email = str(payload.new_email).lower()
    if user.email and new_email == user.email.lower():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That is already your email")

    # If the address is already taken by another active account, refuse - but use
    # the same shape of error so attackers can't probe the user table.
    other = db.scalar(select(User.id).where(User.email == new_email, User.id != user.id))
    if other is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That email is unavailable")

    # Replace prior change requests with the latest one.
    db.execute(
        delete(AuthToken).where(
            AuthToken.user_id == user.id,
            AuthToken.purpose == AuthTokenPurpose.EMAIL_CHANGE,
        )
    )

    plaintext, digest = generate_token()
    token_row = AuthToken(
        user_id=user.id,
        token_hash=digest,
        purpose=AuthTokenPurpose.EMAIL_CHANGE,
        expires_at=datetime.now(UTC) + timedelta(hours=settings.email_verify_ttl_hours),
        new_email=new_email,
        ip=_client_ip(request),
    )
    db.add(token_row)
    db.commit()

    subject, text = email_change_email(
        full_name=user.full_name, token=plaintext, new_email=new_email
    )
    # Important: send the confirmation to the NEW address, not the current one.
    send_transactional_email(
        to=new_email, subject=subject, text=text, context="email_change_confirm"
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _issue_verify_token(db: Session, *, user: User, ip: str | None, to: str) -> None:
    # Replace any outstanding verify tokens with a fresh one.
    db.execute(
        delete(AuthToken).where(
            AuthToken.user_id == user.id,
            AuthToken.purpose == AuthTokenPurpose.EMAIL_VERIFY,
        )
    )

    plaintext, digest = generate_token()
    db.add(
        AuthToken(
            user_id=user.id,
            token_hash=digest,
            purpose=AuthTokenPurpose.EMAIL_VERIFY,
            expires_at=datetime.now(UTC) + timedelta(hours=settings.email_verify_ttl_hours),
            ip=ip,
        )
    )
    db.commit()

    subject, text = verify_email_template(full_name=user.full_name, token=plaintext)
    send_transactional_email(to=to, subject=subject, text=text, context="email_verify")


def issue_initial_verify_token(db: Session, *, user: User, ip: str | None) -> None:
    """Public helper used by the register endpoint to send the first verify email."""
    if not user.email:
        return
    _issue_verify_token(db, user=user, ip=ip, to=user.email)


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None
