"""Pydantic models for the upload pipeline (`/uploads`). `extra="forbid"`."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field


class PresignRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    kind: str
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=3, max_length=120)
    size_bytes: int = Field(ge=1, le=100 * 1024 * 1024)
    community_id: uuid.UUID | None = None


class PresignResponse(BaseModel):
    kind: str
    key: str
    upload_url: str
    method: str = "PUT"
    required_headers: dict[str, str]
    file_url: str
    max_bytes: int
    expires_in: int


class DownloadResponse(BaseModel):
    key: str
    url: str
    expires_in: int
