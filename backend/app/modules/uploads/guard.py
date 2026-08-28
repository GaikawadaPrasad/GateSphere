"""`ensure_confirmed` — the enforced post-upload confirm gate (NFR-SEC-07).

Domain services call this for every file URL they are about to persist. It fails closed:
a URL whose object was never confirmed (magic-number + size check) cannot be stored.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError
from app.modules.uploads.models import ManagedFile
from app.services.storage import key_from_url


def ensure_confirmed(db: Session, url: str | None) -> None:
    if not url:
        return
    key = key_from_url(url)
    if key is None:
        raise BusinessRuleError("file URL is not a managed object", code="FILE_NOT_MANAGED")
    row = db.scalar(select(ManagedFile).where(ManagedFile.object_key == key))
    if row is None or row.status != "confirmed":
        raise BusinessRuleError(
            "file must be confirmed via POST /api/v1/uploads/{id}/confirm before use",
            code="FILE_NOT_CONFIRMED",
            fields={"file_url": "unconfirmed upload"},
        )
