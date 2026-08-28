"""`ensure_confirmed` — the enforced post-upload confirm gate (NFR-SEC-07).

Domain services call this for every file URL they are about to persist. It fails closed:
a URL whose object was never confirmed (magic-number + size check) cannot be stored.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError
from app.modules.uploads.models import ManagedFile
from app.services.storage import key_from_url

_UNCONFIRMED = BusinessRuleError(
    "file must be confirmed via POST /api/v1/uploads/{id}/confirm before use",
    code="FILE_NOT_CONFIRMED",
    fields={"file_url": "unconfirmed upload"},
)


def _key_or_raise(url: str) -> str:
    key = key_from_url(url)
    if key is None:
        raise BusinessRuleError("file URL is not a managed object", code="FILE_NOT_MANAGED")
    return key


def ensure_confirmed(db: Session, url: str | None) -> None:
    if not url:
        return
    row = db.scalar(select(ManagedFile).where(ManagedFile.object_key == _key_or_raise(url)))
    if row is None or row.status != "confirmed":
        raise _UNCONFIRMED


async def ensure_confirmed_async(db: AsyncSession, url: str | None) -> None:
    if not url:
        return
    row = await db.scalar(select(ManagedFile).where(ManagedFile.object_key == _key_or_raise(url)))
    if row is None or row.status != "confirmed":
        raise _UNCONFIRMED
