"""FR-01 / TRD §5.2 — login success/failure and logout are written to the audit log."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

AUDIT = "/api/v1/audit/logs"


def _auth_actions(auth_client, action: str) -> int:
    r = auth_client.get(AUDIT, params={"module": "auth", "action": action})
    assert r.status_code == 200, r.text
    return r.json()["meta"]["total"]


def test_failed_login_is_audited(auth_client):
    before = _auth_actions(auth_client, "login.failed")
    bad = TestClient(app).post(
        "/api/v1/auth/login",
        json={"email": "super_admin@gatesphere.com", "password": "wrong-password"},
    )
    assert bad.status_code == 401
    assert _auth_actions(auth_client, "login.failed") >= before + 1


def test_login_and_logout_are_audited(auth_client):
    before_in = _auth_actions(auth_client, "login.success")
    before_out = _auth_actions(auth_client, "logout")

    c = TestClient(app)
    r = c.post(
        "/api/v1/auth/login",
        json={"email": "security_guard@gatesphere.com", "password": "security_guard@Gate2026!"},
    )
    assert r.status_code == 200
    from conftest import csrf_cookie_value

    c.headers.update({"X-CSRF-Token": csrf_cookie_value(c)})
    assert c.post("/api/v1/auth/logout").status_code == 204

    assert _auth_actions(auth_client, "login.success") >= before_in + 1
    assert _auth_actions(auth_client, "logout") >= before_out + 1


def test_audit_rows_are_immutable_at_the_db(auth_client):
    """AUD-2: the DB trigger blocks UPDATE/DELETE on audit_logs even for the app user."""
    from sqlalchemy import select, text

    from app.db.session import SessionLocal
    from app.modules.audit.models import AuditLog

    with SessionLocal() as db:
        rid = db.scalar(select(AuditLog.id).limit(1))
        assert rid is not None
        for op in (
            "UPDATE audit_logs SET action='tampered' WHERE id=:i",
            "DELETE FROM audit_logs WHERE id=:i",
        ):
            try:
                db.execute(text(op), {"i": rid})
                db.commit()
                raise AssertionError(f"{op.split()[0]} was allowed on audit_logs")
            except Exception as e:  # IntegrityError (restrict_violation)
                db.rollback()
                assert "append-only" in str(e) or "restrict" in str(e).lower()


def test_audit_captures_point_in_time_role(as_role):
    """AUD-1: an audited action records the role the actor was acting AS."""
    from sqlalchemy import select

    from app.db.session import SessionLocal
    from app.modules.audit.models import AuditLog

    guard = as_role("security_guard")
    r = guard.post(
        "/api/v1/gate/events",
        json={"event_type": "vehicle_in", "notes": "audit-role-probe"},
    )
    # the write may 201 or be rejected by RBAC/validation — either way check the login row
    assert r.status_code < 500
    with SessionLocal() as db:
        row = db.scalars(
            select(AuditLog)
            .where(AuditLog.module == "auth", AuditLog.action == "login.success")
            .order_by(AuditLog.created_at.desc())
        ).first()
        assert row is not None and row.role_slug == "security_guard"
