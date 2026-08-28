"""Magic-number sniffing for the upload confirm step (NFR-SEC-07).

We don't need perfect type detection — we need to stop a `.php` / `.exe` / HTML payload
that was uploaded with a `Content-Type: image/png` header. `detect()` returns the set of
MIME types the leading bytes are consistent with; `confirm` passes iff that set intersects
the kind's allow-list.
"""

from __future__ import annotations

_OOXML = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
)
_OLE = ("application/msword", "application/vnd.ms-excel")


def detect(head: bytes) -> set[str]:
    if head.startswith(b"\xff\xd8\xff"):
        return {"image/jpeg"}
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return {"image/png"}
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return {"image/webp"}
    if head.startswith(b"%PDF-"):
        return {"application/pdf"}
    if head[4:8] == b"ftyp":
        brand = head[8:12]
        if brand in (b"qt  ",):
            return {"video/quicktime"}
        return {"video/mp4", "video/quicktime"}
    if head.startswith(b"PK\x03\x04"):
        # zip container — every OOXML doc is one
        return set(_OOXML)
    if head.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        return set(_OLE)
    return set()
