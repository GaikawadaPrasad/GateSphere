"""Canonical response envelope + pagination (AGENTS.md §6, docs/platform/api-contract.md).

Every response — success or error — has the shape:

    { "success": bool, "message": str, "data": <payload|null>, "meta": <page-meta|null> }

Error responses additionally carry `error: { code, fields? }`. Routers return `ok(...)` /
`paginated(...)`; the raw ORM model is never serialized.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Annotated, Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel, Field

T = TypeVar("T")

MAX_PAGE_SIZE = 100


class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int


class Response(BaseModel, Generic[T]):
    """Success envelope for a single object."""

    success: bool = True
    message: str = "OK"
    data: T | None = None
    meta: PageMeta | None = None


class PageResponse(BaseModel, Generic[T]):
    """Success envelope for a list."""

    success: bool = True
    message: str = "OK"
    data: list[T]
    meta: PageMeta


# Backwards-friendly aliases used in older code / docs.
Envelope = Response
PageEnvelope = PageResponse


class PageParams(BaseModel):
    page: int = Field(1, ge=1, le=10_000)
    page_size: int = Field(20, ge=1, le=MAX_PAGE_SIZE)
    sort: str | None = None
    order: str = Field("desc", pattern="^(asc|desc)$")

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def page_params(
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = 20,
    sort: Annotated[str | None, Query()] = None,
    order: Annotated[str, Query(pattern="^(asc|desc)$")] = "desc",
) -> PageParams:
    return PageParams(page=page, page_size=page_size, sort=sort, order=order)


def ok(data: T = None, *, message: str = "OK") -> dict:
    return {"success": True, "message": message, "data": data, "meta": None}


def paginated(rows: Sequence[T], *, total: int, params: PageParams, message: str = "OK") -> dict:
    return {
        "success": True,
        "message": message,
        "data": list(rows),
        "meta": {"page": params.page, "page_size": params.page_size, "total": total},
    }


# Older name kept working.
item = ok
