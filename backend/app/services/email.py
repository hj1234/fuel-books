"""Outbound email transport.

- ``console``: prints to the uvicorn log (development).
- ``resend``: Resend HTTP API; set ``RESEND_API_KEY`` and verify your domain or
  use Resend's onboarding sender (see https://resend.com/docs).
"""

from __future__ import annotations

import logging
from typing import Protocol

import httpx

from app.core.config import settings


logger = logging.getLogger("fuelbooks.email")

RESEND_API_URL = "https://api.resend.com/emails"


class EmailSender(Protocol):
    def send(self, *, to: str, subject: str, text: str) -> None: ...


class ResendEmailSender:
    """Send transactional mail via Resend's REST API."""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    def send(self, *, to: str, subject: str, text: str) -> None:
        payload = {
            "from": settings.email_from,
            "to": [to],
            "subject": subject,
            "text": text,
        }
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    RESEND_API_URL,
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
        except httpx.RequestError as exc:
            logger.exception("Resend request failed: %s", exc)
            raise RuntimeError("Email delivery failed (network error)") from exc

        if response.status_code >= 400:
            hint = ""
            if response.status_code == 403:
                hint = (
                    " (403: invalid/revoked API key, or EMAIL_FROM is not allowed — "
                    "use a verified domain address or onboarding@resend.dev for tests)"
                )
            logger.error(
                "Resend API error: status=%s body=%s%s",
                response.status_code,
                response.text,
                hint,
            )
            raise RuntimeError(
                f"Email delivery failed (Resend HTTP {response.status_code})"
            )


class ConsoleEmailSender:
    """Dev-only sender that prints the email to the uvicorn log.

    Output is intentionally chatty so it stands out among request lines.
    """

    def send(self, *, to: str, subject: str, text: str) -> None:
        sender = settings.email_from
        banner = "=" * 72
        logger.warning(
            "\n%s\n[email][console] from=%s to=%s\nSubject: %s\n%s\n%s",
            banner,
            sender,
            to,
            subject,
            text,
            banner,
        )


def send_transactional_email(
    *, to: str, subject: str, text: str, context: str
) -> None:
    """Send mail and swallow failures after logging.

    Used by auth flows so a misconfigured provider (wrong ``EMAIL_FROM``, expired
    API key, etc.) never becomes a 500 where the contract requires a neutral 204.
    """

    try:
        get_email_sender().send(to=to, subject=subject, text=text)
    except Exception as exc:
        logger.warning(
            "Outbound email failed [%s] to=%s subject=%r: %s",
            context,
            to,
            subject,
            exc,
        )


def get_email_sender() -> EmailSender:
    """Return the configured EmailSender based on ``settings.email_provider``."""
    provider = settings.email_provider.lower()
    if provider == "console":
        return ConsoleEmailSender()
    if provider == "resend":
        key = (settings.resend_api_key or "").strip()
        if not key:
            raise RuntimeError(
                "EMAIL_PROVIDER=resend requires RESEND_API_KEY in the environment"
            )
        return ResendEmailSender(key)
    raise RuntimeError(f"Unsupported EMAIL_PROVIDER={provider!r}")


def _link(path: str, token: str) -> str:
    base = settings.frontend_base_url.rstrip("/")
    return f"{base}{path}?token={token}"


def password_reset_email(*, full_name: str, token: str) -> tuple[str, str]:
    link = _link("/reset-password", token)
    text = (
        f"Hi {full_name or 'there'},\n\n"
        "Someone (hopefully you) asked to reset your Fuel Books password.\n"
        f"Open the link below within {settings.password_reset_ttl_minutes} minutes to set a new one:\n\n"
        f"{link}\n\n"
        "If you didn't request this, ignore this email."
    )
    return "Reset your Fuel Books password", text


def verify_email(*, full_name: str, token: str) -> tuple[str, str]:
    link = _link("/verify-email", token)
    text = (
        f"Hi {full_name or 'there'},\n\n"
        "Please confirm your email address by opening the link below:\n\n"
        f"{link}\n\n"
        f"The link expires in {settings.email_verify_ttl_hours} hours."
    )
    return "Verify your Fuel Books email", text


def email_change_email(*, full_name: str, token: str, new_email: str) -> tuple[str, str]:
    link = _link("/verify-email", token)
    text = (
        f"Hi {full_name or 'there'},\n\n"
        f"Confirm the new email address on your Fuel Books account ({new_email}) by "
        "opening the link below:\n\n"
        f"{link}\n\n"
        f"The link expires in {settings.email_verify_ttl_hours} hours. If you didn't "
        "request this change, ignore this email and your account stays untouched."
    )
    return "Confirm your new Fuel Books email", text
