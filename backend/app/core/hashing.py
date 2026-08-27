"""Non-reversible hashing for lookup keys (phone, ID numbers, pass tokens).

These are NOT passwords — use Argon2 (app.core.security) for those. This is a keyed
SHA-256 so a blacklist / pass lookup can match without storing the raw value.
"""

from __future__ import annotations

import hashlib
import hmac

from app.core.config import settings


def digest(value: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode(), value.strip().encode(), hashlib.sha256
    ).hexdigest()


def digest_opt(value: str | None) -> str | None:
    return digest(value) if value else None
