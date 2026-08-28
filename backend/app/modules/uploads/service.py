"""Upload pipeline service (FR — file handling).

Flow: client calls `POST /uploads` with `{kind, filename, content_type, size_bytes}` ->
we validate against the fixed catalogue and hand back a **presigned PUT URL** + the final
`file_url`. The client PUTs the bytes straight to S3/MinIO, then passes `file_url` to the
domain endpoint (attachment / photo / evidence). `ManagedFileUrl` on those endpoints
guarantees the URL points back into our bucket.
"""

from __future__ import annotations

import re
import uuid

from fastapi import Request

from app.core.errors import BusinessRuleError, NotFoundError
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit
from app.modules.uploads import schemas
from app.modules.uploads.catalogue import KINDS, extension_for
from app.modules.users.models import User
from app.services import storage

_SLUG = re.compile(r"[^a-z0-9]+")
_PRESIGN_TTL = 900


def _safe_stem(filename: str) -> str:
    stem = filename.rsplit("/", 1)[-1].rsplit(".", 1)[0].lower()
    return _SLUG.sub("-", stem).strip("-")[:60] or "file"


class UploadService:
    def __init__(self, db, scope: TenantScope, actor: User, request: Request | None = None):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.request = request

    def _community(self, community_id: uuid.UUID | None) -> uuid.UUID:
        if community_id is not None:
            return self.scope.require(community_id)
        if not self.scope.is_global and len(self.scope.community_ids) == 1:
            return next(iter(self.scope.community_ids))
        raise BusinessRuleError(
            "Specify a community", code="COMMUNITY_REQUIRED", fields={"community_id": "required"}
        )

    def presign(self, payload: schemas.PresignRequest) -> schemas.PresignResponse:
        kind = KINDS.get(payload.kind)
        if kind is None:
            raise NotFoundError("Unknown upload kind")
        if payload.content_type not in kind.content_types:
            raise BusinessRuleError(
                f"{payload.content_type} is not allowed for {kind.slug}",
                code="CONTENT_TYPE_NOT_ALLOWED",
                fields={"content_type": f"one of {sorted(kind.content_types)}"},
            )
        if payload.size_bytes > kind.max_bytes:
            raise BusinessRuleError(
                f"{kind.slug} files must be <= {kind.max_bytes} bytes",
                code="FILE_TOO_LARGE",
                fields={"size_bytes": f"<= {kind.max_bytes}"},
            )
        if kind.scope == "community":
            ns = str(self._community(payload.community_id))
        else:
            ns = str(self.actor.id)
        ext = extension_for(payload.content_type)
        key = f"{kind.prefix}/{ns}/{uuid.uuid4().hex}-{_safe_stem(payload.filename)}{ext}"
        url = storage.presigned_put(key, payload.content_type, expires=_PRESIGN_TTL)
        record_audit(
            self.db,
            module="uploads",
            action="upload.presign",
            actor=self.actor,
            community_id=payload.community_id if kind.scope == "community" else None,
            entity_type="object",
            entity_id=uuid.uuid4().hex,
            request=self.request,
            new={
                "kind": kind.slug,
                "key": key,
                "content_type": payload.content_type,
                "size_bytes": payload.size_bytes,
            },
        )
        return schemas.PresignResponse(
            kind=kind.slug,
            key=key,
            upload_url=url,
            required_headers={"Content-Type": payload.content_type},
            file_url=storage.public_url(key),
            max_bytes=kind.max_bytes,
            expires_in=_PRESIGN_TTL,
        )

    def download(self, key: str) -> schemas.DownloadResponse:
        if storage.object_head(key) is None:
            raise NotFoundError("Object not found")
        return schemas.DownloadResponse(
            key=key, url=storage.presigned_get(key, expires=3600), expires_in=3600
        )
