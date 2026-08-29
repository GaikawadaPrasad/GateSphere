"""Validated application configuration.

Fail-fast: the app refuses to start if required settings are missing or malformed.
Never hardcode environment-specific values elsewhere — read them from here.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- core ---
    ENVIRONMENT: Literal["local", "staging", "production"] = "local"
    DEBUG: bool = True
    SECRET_KEY: str = Field(min_length=32)
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "GateSphere"

    # --- CORS / cookies ---
    # FRONTEND_ORIGIN is the canonical UI origin (used to build invitation links).
    # CORS_ORIGINS optionally widens the allow-list (comma-separated) for extra
    # deploy previews / localhost ports during frontend integration.
    FRONTEND_ORIGIN: str = "http://localhost:3000"
    CORS_ORIGINS: str = ""
    SESSION_COOKIE_NAME: str = "gs_session"
    CSRF_COOKIE_NAME: str = "gs_csrf"
    SESSION_TTL_SECONDS: int = 60 * 60 * 8
    COOKIE_SECURE: bool = False
    COOKIE_DOMAIN: str | None = None

    # --- datastores ---
    DATABASE_URL: PostgresDsn
    REDIS_URL: RedisDsn
    CELERY_BROKER_URL: RedisDsn
    CELERY_RESULT_BACKEND: RedisDsn

    # --- object storage (S3 compatible: MinIO local / Supabase S3 staging) ---
    S3_ENDPOINT_URL: str = "http://minio:9000"
    S3_REGION: str = "us-east-1"
    S3_ACCESS_KEY: str = "gatesphere"
    S3_SECRET_KEY: str = "gatesphere-secret"  # noqa: S105 — local default; overridden in staging
    S3_BUCKET: str = "gatesphere-local"
    S3_PUBLIC_URL: str = "http://localhost:9000"

    # --- email (Brevo) ---
    EMAIL_BACKEND: Literal["console", "brevo"] = "console"
    BREVO_API_KEY: str | None = None
    EMAIL_FROM: str = "no-reply@gatesphere.com"
    EMAIL_FROM_NAME: str = "GateSphere"

    # --- rate limiting ---
    RATE_LIMIT_LOGIN: str = "5/minute"

    @property
    def cors_allow_origins(self) -> list[str]:
        extra = [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        return list(dict.fromkeys([self.FRONTEND_ORIGIN, *extra]))

    @property
    def sqlalchemy_url(self) -> str:
        return str(self.DATABASE_URL)

    @property
    def sqlalchemy_async_url(self) -> str:
        """Same DSN, async driver. psycopg 3 serves both sync and async, so the
        `postgresql+psycopg://` scheme already works for `create_async_engine`.
        A bare `postgresql://` is normalised here."""
        url = str(self.DATABASE_URL)
        if url.startswith("postgresql+psycopg://"):
            return url
        if url.startswith("postgresql://"):
            return "postgresql+psycopg://" + url[len("postgresql://") :]
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
