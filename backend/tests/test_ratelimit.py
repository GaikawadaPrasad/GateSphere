"""Redis sliding-window rate limiter (app/core/ratelimit.py, AGENTS.md §9.2)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core import ratelimit
from app.core.redis import redis_client
from app.main import app


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


def test_fails_open_when_redis_is_down(monkeypatch, _limited):
    from redis.exceptions import RedisError

    class _Boom:
        def pipeline(self, *a, **k):
            raise RedisError("down")

        def get(self, *a, **k):
            raise RedisError("down")

    monkeypatch.setattr(ratelimit, "redis_client", _Boom())
    c = TestClient(app)
    # limiter can't count -> requests still go through (they'll 401, not 429)
    for _ in range(10):
        r = c.post("/api/v1/auth/login", json={"email": "x@x.com", "password": "y"})
        assert r.status_code != 429
