"""Per-account login lockout (app/core/login_lockout.py, AGENTS.md §7).

After N failed logins for one email inside the window, the account locks for the
lock duration — even the correct password gets 429 ACCOUNT_LOCKED. A successful
login clears the counter. Fails CLOSED when Redis is down (M-01,
backend/REMEDIATION_LOG.md) — every login attempt, even with the right password, is
rejected rather than silently unmetered while Redis is unreachable.
"""

from __future__ import annotations

import pytest
from conftest import DEMO_DOMAIN, demo_password
from fastapi.testclient import TestClient

from app.core import login_lockout
from app.core.config import settings
from app.core.redis import redis_client
from app.main import app

PROBE = f"lockout-probe@{DEMO_DOMAIN}"
RESIDENT = f"resident@{DEMO_DOMAIN}"
RESIDENT_PW = demo_password("resident")


@pytest.fixture()
def _lockout():
    """Enable lockout with a tiny threshold, clean keys, then restore."""
    prev = (
        settings.LOGIN_LOCKOUT_ENABLED,
        settings.LOGIN_LOCKOUT_ATTEMPTS,
        settings.LOGIN_LOCKOUT_WINDOW_SECONDS,
        settings.LOGIN_LOCKOUT_SECONDS,
    )
    settings.LOGIN_LOCKOUT_ENABLED = True
    settings.LOGIN_LOCKOUT_ATTEMPTS = 3
    settings.LOGIN_LOCKOUT_WINDOW_SECONDS = 60
    settings.LOGIN_LOCKOUT_SECONDS = 60
    _clear()
    yield
    _clear()
    (
        settings.LOGIN_LOCKOUT_ENABLED,
        settings.LOGIN_LOCKOUT_ATTEMPTS,
        settings.LOGIN_LOCKOUT_WINDOW_SECONDS,
        settings.LOGIN_LOCKOUT_SECONDS,
    ) = prev


def _clear() -> None:
    for pattern in ("gs:loginfail:*", "gs:loginlock:*"):
        for k in redis_client.scan_iter(pattern):
            redis_client.delete(k)


def _try(client: TestClient, email: str, password: str):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_lockout_after_threshold(_lockout):
    c = TestClient(app)
    assert _try(c, PROBE, "wrong-1").status_code == 401
    assert _try(c, PROBE, "wrong-2").status_code == 401
    r = _try(c, PROBE, "wrong-3")
    assert r.status_code == 429, r.text
    body = r.json()
    assert body["success"] is False and body["error"]["code"] == "ACCOUNT_LOCKED"
    assert r.headers.get("Retry-After")


def test_correct_password_rejected_while_locked(_lockout):
    c = TestClient(app)
    for i in range(3):
        _try(c, RESIDENT, f"wrong-{i}")
    r = _try(c, RESIDENT, RESIDENT_PW)
    assert r.status_code == 429, r.text
    assert r.json()["error"]["code"] == "ACCOUNT_LOCKED"


def test_success_resets_counter(_lockout):
    c = TestClient(app)
    assert _try(c, RESIDENT, "wrong-1").status_code == 401
    assert _try(c, RESIDENT, "wrong-2").status_code == 401
    assert _try(c, RESIDENT, RESIDENT_PW).status_code == 200
    # counter cleared — two more failures are still just 401s, not a lock
    assert _try(c, RESIDENT, "wrong-3").status_code == 401
    assert _try(c, RESIDENT, "wrong-4").status_code == 401


def test_other_account_unaffected(_lockout):
    c = TestClient(app)
    for i in range(3):
        _try(c, PROBE, f"wrong-{i}")
    assert _try(c, PROBE, "wrong-4").status_code == 429
    assert _try(c, RESIDENT, RESIDENT_PW).status_code == 200


def test_lockout_unit_helpers(_lockout):
    assert login_lockout.lock_remaining(PROBE) == 0
    assert login_lockout.record_failure(PROBE) == 0
    assert login_lockout.record_failure(PROBE) == 0
    assert login_lockout.record_failure(PROBE) == 60
    assert login_lockout.lock_remaining(PROBE) > 0
    login_lockout.clear_failures(PROBE)  # failures cleared, lock itself stands
    assert login_lockout.lock_remaining(PROBE) > 0


def test_fails_closed_when_redis_is_down(monkeypatch, _lockout):
    """M-01: simulates Redis becoming unreachable mid-request (every call on the client
    raises RedisError, exactly what a dead connection/timeout looks like to the caller).
    Before this fix every attempt here returned 401 (open); now every attempt — including
    one with the *correct* password — must be rejected as if locked, since the module can
    no longer prove the account isn't already over its failure threshold."""
    from redis.exceptions import RedisError

    class _Boom:
        def __getattr__(self, _name):
            def _raise(*a, **k):
                raise RedisError("down")

            return _raise

    monkeypatch.setattr(login_lockout, "redis_client", _Boom())
    c = TestClient(app)
    for i in range(6):
        r = _try(c, PROBE, f"wrong-{i}")
        assert r.status_code == 429, r.text
        assert r.json()["error"]["code"] == "ACCOUNT_LOCKED"
    r = _try(c, RESIDENT, RESIDENT_PW)
    assert r.status_code == 429, r.text
    assert r.json()["error"]["code"] == "ACCOUNT_LOCKED"
