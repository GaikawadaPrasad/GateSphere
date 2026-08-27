"""Auth module has no ORM tables of its own.

Sessions are stored in Redis (see app/core/security.py), keyed by an opaque token.
Password hashing uses Argon2 (see app/core/security.py).
"""

from app.db.base_class import Base  # noqa: F401
