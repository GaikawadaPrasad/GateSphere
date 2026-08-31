"""Validated application configuration.

Fail-fast: the app refuses to start if required settings are missing or malformed.
Never hardcode environment-specific values elsewhere — read them from here.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_SECRETS = {
    "change-me-to-a-random-32+char-string-0000",
    "local-dev-secret-please-change-0000000000",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- core ---
    ENVIRONMENT: Literal["local", "staging", "production"] = "local"
    DEBUG: bool = True
    SECRET_KEY: str = Field(min_length=32)
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "GateSphere"
    # Comma-separated Host header allow-list for TrustedHostMiddleware. "*" (default) is fine
    # for local; production MUST set explicit hostnames.
    ALLOWED_HOSTS: str = "*"
    # Swagger / ReDoc / openapi.json. Defaults on for local + staging, off for production
    # (AGENTS.md §0) unless explicitly re-enabled.
    ENABLE_DOCS: bool | None = None

    # --- DB pool ---
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_RECYCLE_SECONDS: int = 1800  # recycle before a pooled conn is dropped upstream

    # --- CORS / cookies ---
    # FRONTEND_ORIGIN is the canonical UI origin (used to build invitation links).
    # CORS_ORIGINS optionally widens the allow-list (comma-separated) for extra
    # deploy previews / localhost ports during frontend integration.
    FRONTEND_ORIGIN: str = "http://localhost:3000"
    CORS_ORIGINS: str = ""
    # Legacy single-session cookie names — still honoured on READ (frontend, older clients).
    # New sessions are written to a role-bucketed cookie: `<SESSION_COOKIE_PREFIX>_<bucket>_session`
    # (+ `_csrf`). See `app/core/security.py` bucket helpers and docs/backend/AUTHENTICATION.md.
    SESSION_COOKIE_NAME: str = "gs_session"
    CSRF_COOKIE_NAME: str = "gs_csrf"
    SESSION_COOKIE_PREFIX: str = "gatesphere"
    SESSION_TTL_SECONDS: int = 60 * 60 * 8
    SESSION_ACTIVITY_REFRESH_SECONDS: int = 60  # min gap between last_activity_at writes
    COOKIE_SECURE: bool = False
    COOKIE_DOMAIN: str | None = None
    COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"

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

    # --- rate limiting (sliding window over Redis, AGENTS.md §9.2) ---
    # `<max requests>/<window seconds>` per path class. Identity = user:<id> when the
    # session cookie resolves, else ip:<addr>. Fails OPEN on a Redis error.
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_LOGIN: str = "5/60"  # the `auth` class — kept name for back-compat
    RATE_LIMIT_SEARCH: str = "60/60"
    RATE_LIMIT_UPLOAD: str = "30/60"
    RATE_LIMIT_EXPORT: str = "20/60"
    RATE_LIMIT_WRITE: str = "120/60"
    RATE_LIMIT_DEFAULT: str = "600/60"

    @model_validator(mode="after")
    def _production_safety(self) -> Settings:
        if self.ENVIRONMENT == "production":
            problems = []
            if self.DEBUG:
                problems.append("DEBUG must be false")
            if not self.COOKIE_SECURE:
                problems.append("COOKIE_SECURE must be true")
            if self.SECRET_KEY in _INSECURE_SECRETS:
                problems.append("SECRET_KEY is a known dev default")
            if self.ALLOWED_HOSTS.strip() in ("", "*"):
                problems.append("ALLOWED_HOSTS must be an explicit host list")
            if problems:
                raise ValueError("Unsafe production config: " + "; ".join(problems))
        return self

    @property
    def docs_enabled(self) -> bool:
        if self.ENABLE_DOCS is not None:
            return self.ENABLE_DOCS
        return self.ENVIRONMENT != "production"

    @property
    def allowed_hosts(self) -> list[str]:
        raw = [h.strip() for h in self.ALLOWED_HOSTS.split(",") if h.strip()]
        return raw or ["*"]

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
