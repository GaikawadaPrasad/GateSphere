"""CSV export helper (FR-16 reporting).

`csv_response(filename, header, rows)` builds a `text/csv` attachment in the canonical
shape used by `GET /audit/logs.csv`. Callers pass an already-**tenant-scoped**, ordered row
iterable (reuse the module's `list_*` query with a large limit — the same `_scoped()` /
`UnitScopedAccess` filters apply). For very large communities a future version should stream
and/or move to the `reports` Celery queue; today the lists are bounded.
"""

from __future__ import annotations

import csv
import io
from collections.abc import Iterable
from datetime import date, datetime
from decimal import Decimal

from starlette.responses import Response

EXPORT_ROW_CAP = 100_000


def _cell(v: object) -> str:
    if v is None:
        return ""
    if isinstance(v, datetime | date):
        return v.isoformat()
    if isinstance(v, Decimal):
        return f"{v:.2f}"
    return str(v)


def csv_response(filename: str, header: list[str], rows: Iterable[Iterable[object]]) -> Response:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(header)
    for row in rows:
        w.writerow([_cell(c) for c in row])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
