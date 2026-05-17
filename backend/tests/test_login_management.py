"""Tests covering the login-management plan: tokens, lockout, rate limit."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session


# ---------- helpers ---------------------------------------------------------


def _register(client: TestClient, email: str, password: str = "Password123") -> None:
    res = client.post(
        "/v1/auth/register",
        json={"email": email, "full_name": "Test User", "password": password},
    )
    assert res.status_code == 201, res.text


def _login(client: TestClient, email: str, password: str) -> int:
    return client.post(
        "/v1/auth/login-json",
        json={"email": email, "password": password},
    ).status_code


def _login_with_token(client: TestClient, email: str, password: str) -> str:
    res = client.post(
        "/v1/auth/login-json",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _latest_token_plaintext(monkeypatch, captured: list, ) -> str:
    """Pull the latest reset/verify token out of the captured email body."""
    # Each email body contains a URL of the form .../?token=<plaintext>.
    body = captured[-1]["text"]
    marker = "token="
    idx = body.rfind(marker)
    assert idx != -1, body
    return body[idx + len(marker):].split()[0]


@pytest.fixture()
def captured_emails(monkeypatch) -> list:
    """Capture outbound emails instead of printing them to the log."""
    captured: list[dict] = []

    def send_capture(*, to: str, subject: str, text: str, context: str) -> None:
        captured.append({"to": to, "subject": subject, "text": text, "context": context})

    from app.api.v1 import auth_email as auth_email_mod
    from app.api.v1 import auth_passwords as auth_passwords_mod
    from app.services import email as email_svc

    monkeypatch.setattr(email_svc, "send_transactional_email", send_capture)
    monkeypatch.setattr(auth_email_mod, "send_transactional_email", send_capture)
    monkeypatch.setattr(auth_passwords_mod, "send_transactional_email", send_capture)
    return captured


# ---------- register / verify ----------------------------------------------


def test_register_sends_verify_email_and_marks_user_unverified(
    client: TestClient, captured_emails: list, db_session: Session
):
    _register(client, "alice@example.com")

    assert len(captured_emails) == 1
    assert captured_emails[0]["to"] == "alice@example.com"
    assert "Verify" in captured_emails[0]["subject"]

    from app.models.user import User

    user = db_session.scalar(select(User).where(User.email == "alice@example.com"))
    assert user is not None
    assert user.email_verified_at is None


def test_verify_email_marks_user_verified_and_is_single_use(
    client: TestClient, captured_emails: list, db_session: Session
):
    _register(client, "alice@example.com")
    token = _latest_token_plaintext(None, captured_emails)

    res = client.post("/v1/auth/email/verify", json={"token": token})
    assert res.status_code == 204

    from app.models.user import User

    db_session.expire_all()
    user = db_session.scalar(select(User).where(User.email == "alice@example.com"))
    assert user.email_verified_at is not None

    # Re-using the same token must fail.
    res = client.post("/v1/auth/email/verify", json={"token": token})
    assert res.status_code == 400


def test_verify_email_rejects_expired_token(
    client: TestClient, captured_emails: list, db_session: Session
):
    _register(client, "alice@example.com")

    from app.models.auth_token import AuthToken

    token_row = db_session.scalars(select(AuthToken)).one()
    token_row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db_session.commit()

    token = _latest_token_plaintext(None, captured_emails)
    res = client.post("/v1/auth/email/verify", json={"token": token})
    assert res.status_code == 400


# ---------- password reset --------------------------------------------------


def test_forgot_password_returns_204_for_unknown_email(
    client: TestClient, captured_emails: list
):
    res = client.post(
        "/v1/auth/password/forgot", json={"email": "nobody@example.com"}
    )
    assert res.status_code == 204
    # We must NOT email an address we have no account for.
    assert captured_emails == []


def test_password_reset_happy_path_invalidates_token(
    client: TestClient, captured_emails: list
):
    _register(client, "bob@example.com", password="Original123")
    captured_emails.clear()  # drop the verify email

    res = client.post("/v1/auth/password/forgot", json={"email": "bob@example.com"})
    assert res.status_code == 204
    token = _latest_token_plaintext(None, captured_emails)

    # Reset.
    res = client.post(
        "/v1/auth/password/reset", json={"token": token, "new_password": "Brand-new-1"}
    )
    assert res.status_code == 204

    # Old password no longer works.
    assert _login(client, "bob@example.com", "Original123") == 401
    # New password works.
    assert _login(client, "bob@example.com", "Brand-new-1") == 200

    # Token cannot be reused.
    res = client.post(
        "/v1/auth/password/reset",
        json={"token": token, "new_password": "Another-one-1"},
    )
    assert res.status_code == 400


# ---------- change password -------------------------------------------------


def test_change_password_requires_current(client: TestClient, captured_emails: list):
    _register(client, "claire@example.com", password="Old-password-1")
    token = _login_with_token(client, "claire@example.com", "Old-password-1")
    headers = {"authorization": f"Bearer {token}"}

    res = client.post(
        "/v1/auth/password/change",
        json={"current_password": "wrong", "new_password": "Brand-new-1"},
        headers=headers,
    )
    assert res.status_code == 400

    res = client.post(
        "/v1/auth/password/change",
        json={"current_password": "Old-password-1", "new_password": "Brand-new-1"},
        headers=headers,
    )
    assert res.status_code == 204
    assert _login(client, "claire@example.com", "Brand-new-1") == 200


# ---------- lockout ---------------------------------------------------------


def test_lockout_after_max_failed_logins(
    client: TestClient, captured_emails: list, db_session: Session
):
    from app.core.config import settings
    from app.models.user import User

    _register(client, "dave@example.com", password="Correct-1")
    captured_emails.clear()

    for _ in range(settings.max_failed_logins):
        assert _login(client, "dave@example.com", "wrong-password") == 401

    # On the next attempt the correct password must still 401 because the
    # account is now locked.
    assert _login(client, "dave@example.com", "Correct-1") == 401

    db_session.expire_all()
    user = db_session.scalar(select(User).where(User.email == "dave@example.com"))
    assert user.locked_until is not None
    from app.core.security import as_utc

    assert as_utc(user.locked_until) > datetime.now(UTC)

    # Once the lockout window expires the right password works again and
    # the counter resets.
    user.locked_until = datetime.now(UTC) - timedelta(seconds=1)
    db_session.commit()

    assert _login(client, "dave@example.com", "Correct-1") == 200

    db_session.expire_all()
    user = db_session.scalar(select(User).where(User.email == "dave@example.com"))
    assert user.failed_login_count == 0
    assert user.locked_until is None
    assert user.last_login_at is not None


# ---------- email change ----------------------------------------------------


def test_email_change_flow(
    client: TestClient, captured_emails: list, db_session: Session
):
    _register(client, "erica@example.com", password="Old-1234567")
    captured_emails.clear()
    token = _login_with_token(client, "erica@example.com", "Old-1234567")
    headers = {"authorization": f"Bearer {token}"}

    # Wrong password is rejected.
    res = client.post(
        "/v1/auth/email/change/request",
        json={"new_email": "erica2@example.com", "current_password": "nope"},
        headers=headers,
    )
    assert res.status_code == 400
    assert captured_emails == []

    res = client.post(
        "/v1/auth/email/change/request",
        json={"new_email": "erica2@example.com", "current_password": "Old-1234567"},
        headers=headers,
    )
    assert res.status_code == 204
    assert captured_emails[-1]["to"] == "erica2@example.com"
    plaintext = _latest_token_plaintext(None, captured_emails)

    res = client.post("/v1/auth/email/verify", json={"token": plaintext})
    assert res.status_code == 204

    from app.models.user import User

    db_session.expire_all()
    user = db_session.scalar(select(User).where(User.email == "erica2@example.com"))
    assert user is not None
    assert user.email_verified_at is not None
