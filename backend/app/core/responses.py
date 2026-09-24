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

MAX_PAGE_SIZE = 1000


class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int


class CursorMeta(BaseModel):
    """Keyset page metadata (AGENTS.md §4.3): no `total`; `next_cursor` null on the last page."""

    page_size: int
    next_cursor: str | None


class Response(BaseModel, Generic[T]):
    """Success envelope for a single object."""

    success: bool = True
    message: str = "OK"
    data: T | None = None
    meta: PageMeta | CursorMeta | None = None


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
    """Offset pagination (AGENTS.md §4.3).

    List ordering is server-defined per endpoint (deterministic, typically
    `created_at` descending) — there are deliberately no client `sort`/`order`
    knobs, so an unvalidated sort field can never reach a query.
    """

    page: int = Field(1, ge=1, le=10_000)
    page_size: int = Field(20, ge=1, le=MAX_PAGE_SIZE)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def page_params(
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = 20,
    limit: Annotated[int | None, Query(ge=1, le=MAX_PAGE_SIZE, deprecated=True)] = None,
) -> PageParams:
    return PageParams(page=page, page_size=limit if limit is not None else page_size)


def ok(data: T = None, *, message: str = "OK") -> dict:
    return {"success": True, "message": message, "data": data, "meta": None}


def paginated(rows: Sequence[T], *, total: int, params: PageParams, message: str = "OK") -> dict:
    return {
        "success": True,
        "message": message,
        "data": list(rows),
        "meta": {"page": params.page, "page_size": params.page_size, "total": total},
    }


def cursor_page(
    rows: Sequence[T], *, next_cursor: str | None, page_size: int, message: str = "OK"
) -> dict:
    """Keyset page (AGENTS.md §4.3): no `total` — counting a hot append-only table on every
    page is the slow path. `next_cursor` is null on the last page."""
    return {
        "success": True,
        "message": message,
        "data": list(rows),
        "meta": {"page_size": page_size, "next_cursor": next_cursor},
    }


# Older name kept working.
item = ok
