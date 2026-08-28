"""The fixed upload catalogue — the ONLY file kinds the platform accepts.

Each kind pins an object-key prefix, the allowed MIME types, and a hard size cap. A client
asks `/uploads` for a presigned PUT URL for one of these kinds; nothing else can be stored.
"""

from __future__ import annotations

from dataclasses import dataclass

_MB = 1024 * 1024

_IMAGE = ("image/jpeg", "image/png", "image/webp")
_DOC = ("application/pdf",)
_OFFICE = (
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
)
_VIDEO = ("video/mp4", "video/quicktime")

_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
}


@dataclass(frozen=True)
class UploadKind:
    slug: str
    prefix: str
    content_types: tuple[str, ...]
    max_bytes: int
    scope: str  # "community" | "user" — how the key path is namespaced


KINDS: dict[str, UploadKind] = {
    k.slug: k
    for k in (
        UploadKind("visitor_photo", "visitors/photos", _IMAGE, 5 * _MB, "community"),
        UploadKind("id_document", "kyc/ids", (*_IMAGE, *_DOC), 10 * _MB, "community"),
        UploadKind("staff_photo", "domestic-staff/photos", _IMAGE, 5 * _MB, "community"),
        UploadKind(
            "ticket_attachment",
            "complaints/attachments",
            (*_IMAGE, *_DOC, *_OFFICE),
            15 * _MB,
            "community",
        ),
        UploadKind(
            "incident_evidence",
            "incidents/evidence",
            (*_IMAGE, *_DOC, *_VIDEO),
            25 * _MB,
            "community",
        ),
        UploadKind("delivery_photo", "deliveries/photos", _IMAGE, 5 * _MB, "community"),
        UploadKind("vehicle_evidence", "vehicles/violations", _IMAGE, 10 * _MB, "community"),
        UploadKind(
            "announcement_media",
            "communication/media",
            (*_IMAGE, *_DOC),
            15 * _MB,
            "community",
        ),
        UploadKind("payment_proof", "billing/proofs", (*_IMAGE, *_DOC), 10 * _MB, "community"),
        UploadKind("user_avatar", "users/avatars", _IMAGE, 3 * _MB, "user"),
    )
}


def extension_for(content_type: str) -> str:
    return _EXT.get(content_type, "")
