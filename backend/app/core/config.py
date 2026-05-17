from __future__ import annotations

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./dev.db"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_exp_minutes: int = 60 * 24 * 7

    internal_job_token: str = "change-me"

    # Frontend URL used to build links inside outbound emails.
    frontend_base_url: str = "http://localhost:3000"

    # Email transport: "console" logs only; "resend" uses https://resend.com API.
    email_provider: str = "console"
    email_from: str = "Fuel Books <no-reply@example.com>"
    resend_api_key: str | None = Field(default=None, validation_alias="RESEND_API_KEY")

    # Account-management TTLs.
    password_reset_ttl_minutes: int = 30
    email_verify_ttl_hours: int = 24

    # Login lockout: after N consecutive failed attempts, lock the user out for
    # the given window. Successful logins reset the counter.
    max_failed_logins: int = 5
    lockout_minutes: int = 15

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, v: object) -> object:
        """Railway/Heroku Postgres URLs use postgres:// or postgresql:// without a driver.

        SQLAlchemy needs an explicit driver for psycopg v3 (postgresql+psycopg://).
        """
        if not isinstance(v, str):
            return v
        url = v.strip()
        if url.startswith("postgres://"):
            url = "postgresql://" + url.removeprefix("postgres://")
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url


settings = Settings()

