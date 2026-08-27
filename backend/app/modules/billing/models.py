"""SQLAlchemy ORM models for Maintenance & Billing.

All tenant-scoped tables carry community_id (FK -> communities.id) and are always
filtered by the caller's community. Enforce key invariants with DB constraints too.
"""

from app.db.base_class import Base  # noqa: F401
