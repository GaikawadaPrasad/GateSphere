"""The request transaction commits BEFORE the response is sent (re-audit #5).

Since FastAPI 0.121, the code after `yield` in a dependency runs *after the response is sent*
unless the dependency is declared with `scope="function"`. `get_async_db` commits after its
`yield`, so with the default scope:

* a client received `201` before the row was committed — its next request (often served by a
  different worker) got `404` for the thing it had just created (observed in Newman and the
  E2E invoice journey);
* a commit failure (constraint, deadlock, lost connection) happened after the client had
  already been told the write succeeded.

This test walks every route's real dependency graph and fails if any `get_async_db` node is not
function-scoped.
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator
from typing import Any

from fastapi.dependencies.models import Dependant

from app.db.session import get_async_db
from app.main import app


def _api_routes(routes: Iterable[Any]) -> Iterator[Any]:
    """Every route with a dependency graph, including routers nested by FastAPI >= 0.13x."""
    for route in routes:
        if hasattr(route, "effective_candidates"):
            yield from _api_routes(route.effective_candidates())
        elif hasattr(route, "dependant"):
            yield route


def _db_nodes(dep: Dependant) -> Iterator[Dependant]:
    for child in dep.dependencies:
        if child.call is get_async_db:
            yield child
        yield from _db_nodes(child)


def test_every_db_session_dependency_commits_before_the_response() -> None:
    offenders: set[str] = set()
    checked = 0
    for route in _api_routes(app.routes):
        for node in _db_nodes(route.dependant):
            checked += 1
            if node.scope != "function":
                offenders.add(f"{sorted(getattr(route, 'methods', []))} {route.path}")
    assert checked > 100, "the scan found too few DB dependencies — it is not seeing the routes"
    assert not offenders, (
        "get_async_db must be Depends(get_async_db, scope='function') so the transaction commits "
        "before the response is sent; request-scoped on: " + ", ".join(sorted(offenders)[:10])
    )
