"""Upload pipeline API. Any authenticated user may request a presigned URL; the catalogue
(`catalogue.py`) is the single source of allowed kinds / content types / size caps.

Contract: docs/backend/api/uploads.md.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.core.responses import Response as Envelope
from app.core.responses import ok
from app.core.security import require_auth
from app.core.tenancy import TenantContext, tenant_context
from app.modules.uploads import schemas
from app.modules.uploads.catalogue import KINDS
from app.modules.uploads.service import UploadService
from app.modules.users.models import User

router = APIRouter(prefix="/uploads", tags=["Uploads"])


def upload_service(
    request: Request,
    ctx: TenantContext = Depends(tenant_context),
    user: User = Depends(require_auth),
) -> UploadService:
    return UploadService(ctx.db, ctx.scope, user, request)


@router.get("/health", summary="Upload pipeline liveness")
async def module_health() -> dict:
    return ok({"module": "uploads", "status": "ok"})


@router.get("/kinds")
def list_kinds() -> dict:
    return ok(
        {
            k.slug: {
                "content_types": list(k.content_types),
                "max_bytes": k.max_bytes,
                "scope": k.scope,
            }
            for k in KINDS.values()
        }
    )


@router.post("", response_model=Envelope[schemas.PresignResponse])
def presign(payload: schemas.PresignRequest, svc: UploadService = Depends(upload_service)) -> dict:
    return ok(svc.presign(payload), message="Upload authorised")


@router.get("/download", response_model=Envelope[schemas.DownloadResponse])
def download(key: str, svc: UploadService = Depends(upload_service)) -> dict:
    return ok(svc.download(key))
