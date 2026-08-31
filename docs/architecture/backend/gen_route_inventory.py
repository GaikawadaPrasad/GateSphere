#!/usr/bin/env python3
"""Regenerate the "Appendix — complete route table (generated)" section of
route-inventory.md from the live FastAPI route table.

    docker compose run --rm -v "$PWD/docs:/docs" -e PYTHONPATH=/app backend \
        python /docs/architecture/backend/gen_route_inventory.py

It rewrites only the text below the "## Appendix" marker; the hand-written tables
above it are left untouched.
"""

from __future__ import annotations

import pathlib

from fastapi.routing import APIRoute

import app.main as m

HERE = pathlib.Path(__file__).parent
DOC = HERE / "route-inventory.md"
MARKER = "## Appendix — complete route table (generated)"


def _perm(route: APIRoute) -> str:
    # scan the closure of every dependency callable for a permission string
    codes: list[str] = []
    for dep in route.dependant.dependencies:
        call = getattr(dep, "call", None)
        closure = getattr(call, "__closure__", None) or ()
        for c in closure:
            v = c.cell_contents
            if isinstance(v, str) and ":" in v and " " not in v:
                codes.append(v)
    if codes:
        return "`" + "` / `".join(sorted(set(codes))) + "`"
    names = {
        d.call.__name__
        for d in route.dependant.dependencies
        if getattr(d, "call", None)
    }
    if "require_platform_admin" in names:
        return "platform-admin"
    if {"require_auth_async", "get_current_user", "optional_user"} & names:
        return "session"
    return "public"


def main() -> None:
    rows = []
    for r in m.app.routes:
        if not isinstance(r, APIRoute):
            continue
        parts = r.path.split("/")
        mod = parts[3] if r.path.startswith("/api/v1/") and len(parts) > 3 else "ops"
        for meth in sorted(r.methods - {"HEAD", "OPTIONS"}):
            rows.append((str(mod), meth, r.path, _perm(r), r.name))
    rows.sort(key=lambda x: (x[0].lower(), x[2], x[1]))

    total = len(rows)
    api = sum(1 for _, _, p, _, _ in rows if p.startswith("/api/v1/"))
    lines = [
        MARKER,
        "",
        f"Every registered `(method, path)` — {total} rows ({api} under `/api/v1/`) — "
        "emitted from `app.main.app` by `docs/architecture/backend/gen_route_inventory.py`. "
        "Regenerate on any route change.",
        "",
        "| Module | Method | Path | Auth / permission | Handler |",
        "|---|---|---|---|---|",
    ]
    for mod, meth, path, perm, name in rows:
        lines.append(f"| {mod} | {meth} | `{path}` | {perm} | `{name}` |")

    head = DOC.read_text().split(MARKER)[0].rstrip() + "\n\n"
    DOC.write_text(head + "\n".join(lines) + "\n")
    print(f"route-inventory.md appendix: {total} rows ({api} API)")


if __name__ == "__main__":
    main()
