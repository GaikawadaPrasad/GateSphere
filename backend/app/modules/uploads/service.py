"""Upload pipeline service (FR — file handling). Async stack (ADR-010).

Flow: client calls `POST /uploads` with `{kind, filename, content_type, size_bytes}` ->
we validate against the fixed catalogue and hand back a **presigned PUT URL** + the final
`file_url`. The client PUTs the bytes straight to S3/MinIO, then `POST /uploads/{id}/confirm`
runs the size + magic-byte check, then passes `file_url` to the domain endpoint.
`ManagedFileUrl` + `uploads.guard.ensure_confirmed` are the two gates on a stored URL.

`storage.*` is blocking boto3 — every call is off-loaded to a worker thread.
"""

from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime

from anyio import to_thread
from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BusinessRuleError, NotFoundError
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit_async
from app.modules.uploads import schemas
from app.modules.uploads.catalogue import KINDS, extension_for
from app.modules.uploads.models import ManagedFile
from app.modules.uploads.sniff import detect
from app.modules.users.models import User
from app.services import storage

_SLUG = re.compile(r"[^a-z0-9]+")
_PRESIGN_TTL = 900


def _safe_stem(filename: str) -> str:
    stem = filename.rsplit("/", 1)[-1].rsplit(".", 1)[0].lower()
    return _SLUG.sub("-", stem).strip("-")[:60] or "file"


class UploadService:
    def __init__(
        self, db: AsyncSession, scope: TenantScope, actor: User, request: Request | None = None
    ):
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

    async def presign(self, payload: schemas.PresignRequest) -> schemas.PresignResponse:
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
        ns = (
            str(self._community(payload.community_id))
            if kind.scope == "community"
            else str(self.actor.id)
        )
        ext = extension_for(payload.content_type)
        key = f"{kind.prefix}/{ns}/{uuid.uuid4().hex}-{_safe_stem(payload.filename)}{ext}"
        url = await to_thread.run_sync(
            storage.presigned_put, key, payload.content_type, _PRESIGN_TTL
        )
        community_id = payload.community_id if kind.scope == "community" else None
        mf = ManagedFile(
            community_id=community_id,
            object_key=key,
            kind=kind.slug,
            created_by_user_id=self.actor.id,
            declared_content_type=payload.content_type,
            declared_size_bytes=payload.size_bytes,
            status="pending",
        )
        self.db.add(mf)
        await self.db.flush()
        await record_audit_async(
            self.db,
            module="uploads",
            action="upload.presign",
            actor=self.actor,
            community_id=community_id,
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
            file_id=mf.id,
            kind=kind.slug,
            key=key,
            upload_url=url,
            required_headers={"Content-Type": payload.content_type},
            file_url=storage.public_url(key),
            max_bytes=kind.max_bytes,
            expires_in=_PRESIGN_TTL,
            confirm_url=f"/api/v1/uploads/{mf.id}/confirm",
        )

    def _assert_can_access(self, mf: ManagedFile, *, label: str = "Upload") -> None:
        """A file is reachable by its creator, or by any member of its community
        (community-scoped kinds). Cross-community / another user's personal file -> 404.
        A global caller (Super Admin) may reach anything."""
        if self.scope.is_global or mf.created_by_user_id == self.actor.id:
            return
        if mf.community_id is not None and mf.community_id in self.scope.community_ids:
            return
        raise NotFoundError(f"{label} not found")

    async def _managed_file(self, file_id: uuid.UUID) -> ManagedFile:
        mf = await self.db.get(ManagedFile, file_id)
        if mf is None:
            raise NotFoundError("Upload not found")
        self._assert_can_access(mf)
        return mf

    async def confirm(self, file_id: uuid.UUID) -> schemas.ConfirmResponse:
        mf = await self._managed_file(file_id)
        if mf.status == "confirmed":
            return schemas.ConfirmResponse(
                file_id=mf.id,
                status="confirmed",
                file_url=storage.public_url(mf.object_key),
                detected_content_type=mf.detected_content_type,
                size_bytes=mf.size_bytes,
            )
        if mf.status == "rejected":
            raise BusinessRuleError(
                f"Upload was rejected: {mf.reject_reason}", code="UPLOAD_REJECTED"
            )
        kind = KINDS[mf.kind]
        head = await to_thread.run_sync(storage.object_head, mf.object_key)
        if head is None:
            raise BusinessRuleError("No object was uploaded to the presigned URL", code="NO_OBJECT")

        size = head.get("content_length") or 0
        reason: str | None = None
        detected: str | None = None
        if size > kind.max_bytes:
            reason = f"file is {size} bytes, over the {kind.max_bytes} cap for {kind.slug}"
        else:
            head_bytes = await to_thread.run_sync(storage.object_bytes, mf.object_key, 32)
            candidates = detect(head_bytes or b"")
            if not candidates:
                reason = "file signature not recognised"
            elif not candidates & set(kind.content_types):
                reason = f"file contents ({sorted(candidates)}) not allowed for {kind.slug}"
            else:
                detected = next(iter(candidates), None)

        if reason:
            await to_thread.run_sync(storage.delete_object, mf.object_key)
            mf.status = "rejected"
            mf.reject_reason = reason[:200]
            mf.size_bytes = size
            await self.db.flush()
            await self._audit_confirm(mf, "upload.reject")
            raise BusinessRuleError(reason, code="UPLOAD_REJECTED")

        mf.status = "confirmed"
        mf.detected_content_type = detected
        mf.size_bytes = size
        mf.confirmed_at = datetime.now(UTC)
        await self.db.flush()
        await self._audit_confirm(mf, "upload.confirm")
        return schemas.ConfirmResponse(
            file_id=mf.id,
            status="confirmed",
            file_url=storage.public_url(mf.object_key),
            detected_content_type=detected,
            size_bytes=size,
        )

    async def _audit_confirm(self, mf: ManagedFile, action: str) -> None:
        await record_audit_async(
            self.db,
            module="uploads",
            action=action,
            actor=self.actor,
            community_id=mf.community_id,
            entity_type="managed_file",
            entity_id=mf.id,
            request=self.request,
            new={"key": mf.object_key, "status": mf.status, "reason": mf.reject_reason},
        )

    async def download(self, key: str) -> schemas.DownloadResponse:
        # Authorize by the `managed_files` row for this key — never hand out a
        # presigned GET for an arbitrary object key (IDOR).
        mf = await self.db.scalar(select(ManagedFile).where(ManagedFile.object_key == key))
        if mf is None or mf.status != "confirmed":
            raise NotFoundError("Object not found")
        self._assert_can_access(mf, label="Object")
        if await to_thread.run_sync(storage.object_head, key) is None:
            raise NotFoundError("Object not found")
        url = await to_thread.run_sync(storage.presigned_get, key, 3600)
        return schemas.DownloadResponse(key=key, url=url, expires_in=3600)
