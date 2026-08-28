"""Shared file-reference validation.

Every user-supplied file URL in the API must point at an object in **our** managed bucket
(uploaded via the `/uploads` presign flow). `ManagedFileUrl` rejects arbitrary external
URLs — a `javascript:` / `http://evil/…` value can never land in a stored column.
"""

from __future__ import annotations

from typing import Annotated

from pydantic import AfterValidator

from app.services.storage import key_from_url


def _validate_managed_url(value: str) -> str:
    v = value.strip()
    if key_from_url(v) is None:
        raise ValueError(
            "file URL must be an object in the GateSphere bucket "
            "(upload via POST /api/v1/uploads first)"
        )
    return v


ManagedFileUrl = Annotated[str, AfterValidator(_validate_managed_url)]
