"""Redis sliding-window rate limiter (app/core/ratelimit.py, AGENTS.md §9.2)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.core import ratelimit
from app.core.redis import redis_client
from app.main import app


def _fake_request(method: str, path: str) -> Request:
    return Request(
        {"type": "http", "method": method, "path": path, "headers": [], "query_string": b""}
    )


@pytest.fixture()
def _limited():
    """Enable the limiter with a tiny `auth` budget for the test, then restore."""
    prev_enabled = ratelimit.settings.RATE_LIMIT_ENABLED
    prev_auth = ratelimit.settings.RATE_LIMIT_LOGIN
    ratelimit.settings.RATE_LIMIT_ENABLED = True
    ratelimit.settings.RATE_LIMIT_LOGIN = "3/60"
    for k in redis_client.scan_iter("gs:rl:*"):
        redis_client.delete(k)
    yield
    ratelimit.settings.RATE_LIMIT_ENABLED = prev_enabled
    ratelimit.settings.RATE_LIMIT_LOGIN = prev_auth
    for k in redis_client.scan_iter("gs:rl:*"):
        redis_client.delete(k)


def test_auth_class_is_limited_and_returns_canonical_429(_limited):
    c = TestClient(app)
    codes = []
    for _ in range(6):
        r = c.post("/api/v1/auth/login", json={"email": "x@example.com", "password": "nope"})
        codes.append(r.status_code)
    assert 429 in codes, codes
    r = c.post("/api/v1/auth/login", json={"email": "x@example.com", "password": "nope"})
    assert r.status_code == 429
    body = r.json()
    assert body["error"]["code"] == "RATE_LIMITED" and body["success"] is False
    assert r.headers.get("Retry-After")
    assert r.headers.get("X-RateLimit-Limit") == "3"


def test_health_is_exempt(_limited):
    c = TestClient(app)
    for _ in range(20):
        assert c.get("/healthz").status_code == 200


def test_auth_fails_closed_when_redis_is_down(monkeypatch, _limited):
    """M-01 (backend/REMEDIATION_LOG.md): `auth` is a fail-closed class. Before this fix
    a Redis outage silently let every request through unmetered (this test used to assert
    `status_code != 429` and pass); now it must get a clean 503, never reach the login
    handler at all — proven by asserting the login endpoint's own error codes (401/429)
    never appear."""
    from redis.exceptions import RedisError

    class _Boom:
        def pipeline(self, *a, **k):
            raise RedisError("down")

        def get(self, *a, **k):
            raise RedisError("down")

    monkeypatch.setattr(ratelimit, "redis_client", _Boom())
    c = TestClient(app)
    for _ in range(10):
        r = c.post("/api/v1/auth/login", json={"email": "x@x.com", "password": "y"})
        assert r.status_code == 503, r.text
        assert r.json()["error"]["code"] == "RATE_LIMIT_UNAVAILABLE"


def test_non_sensitive_classes_still_fail_open_when_redis_is_down(monkeypatch, _limited):
    """M-01: only `auth`/`payment` fail closed — every other class (search/upload/export/
    write/default) keeps the original availability-over-strictness behavior. Uses the
    `default` class (`GET /api/v1/auth/me`, unauthenticated) so a Redis outage must still
    reach the real handler (401), not the new 503 fail-closed path."""
    from redis.exceptions import RedisError

    class _Boom:
        def pipeline(self, *a, **k):
            raise RedisError("down")

        def get(self, *a, **k):
            raise RedisError("down")

    monkeypatch.setattr(ratelimit, "redis_client", _Boom())
    c = TestClient(app)
    r = c.get("/api/v1/auth/me")
    assert r.status_code != 503
    assert r.status_code == 401


def test_classify_payment_paths():
    """M-01: only mutating billing/payments paths classify as `payment` — GET/list/receipt
    stay out of it, since those aren't the thing the fail-closed behavior protects."""
    assert ratelimit.classify(_fake_request("POST", "/api/v1/billing/payments")) == "payment"
    assert (
        ratelimit.classify(_fake_request("POST", "/api/v1/billing/payments/abc/refund"))
        == "payment"
    )
    assert ratelimit.classify(_fake_request("GET", "/api/v1/billing/payments")) != "payment"
    assert (
        ratelimit.classify(_fake_request("GET", "/api/v1/billing/payments/abc/receipt"))
        != "payment"
    )


def test_payment_class_fails_closed_when_redis_is_down(monkeypatch, _limited):
    """M-01: same fail-closed treatment as `auth` — proven at the dispatch level. The
    middleware runs before auth/dependency resolution, so an unauthenticated request is
    enough: a 503 here (not the endpoint's own 401) proves the class was intercepted
    before ever reaching the handler."""
    from redis.exceptions import RedisError

    class _Boom:
        def pipeline(self, *a, **k):
            raise RedisError("down")

        def get(self, *a, **k):
            raise RedisError("down")

    monkeypatch.setattr(ratelimit, "redis_client", _Boom())
    c = TestClient(app)
    r = c.post("/api/v1/billing/payments", json={})
    assert r.status_code == 503, r.text
    assert r.json()["error"]["code"] == "RATE_LIMIT_UNAVAILABLE"


def test_invite_token_is_redacted_in_logs():
    from app.core.logging import redact_path

    assert redact_path("/api/v1/invitations/abc123secret") == "/api/v1/invitations/<redacted>"
    assert (
        redact_path("/api/v1/invitations/abc123secret/accept")
        == "/api/v1/invitations/<redacted>/accept"
    )
    assert redact_path("/api/v1/visitors/requests/xyz") == "/api/v1/visitors/requests/xyz"
