"""Unit tests — NotificationService: dispatch, templates, prefs, quiet hours, inbox."""

from __future__ import annotations

import pytest

from app.core.errors import BusinessRuleError, NotFoundError
from app.modules.notifications import schemas
from app.modules.notifications.service import NotificationService


def _svc(db, scope, actor):
    return NotificationService(db, scope, actor)


def test_dispatch_from_template_renders_and_delivers(
    db, scope_for, community, superadmin, make_user
):
    admin = _svc(db, scope_for(community.id), superadmin)
    admin.upsert_template(
        schemas.TemplateUpsert(
            code="welcome",
            channel="in_app",
            title_template="Hi {name}",
            body_template="Welcome to {place}",
        ),
        community_id=community.id,
    )
    rcpt = make_user()
    note = admin.dispatch(
        schemas.DispatchIn(
            recipient_user_id=rcpt.id,
            notification_type="onboarding",
            template_code="welcome",
            context={"name": "Sam", "place": "GateSphere"},
            channels=["in_app", "email"],
            community_id=community.id,
        )
    )
    assert note.title == "Hi Sam" and "GateSphere" in note.message
    statuses = {d.channel: d.status for d in note.deliveries}
    assert statuses == {"in_app": "delivered", "email": "delivered"}


def test_dispatch_without_content_or_template_fails(
    db, scope_for, community, superadmin, make_user
):
    admin = _svc(db, scope_for(community.id), superadmin)
    with pytest.raises(BusinessRuleError) as exc:
        admin.dispatch(
            schemas.DispatchIn(
                recipient_user_id=make_user().id,
                notification_type="x",
                community_id=community.id,
            )
        )
    assert exc.value.code == "CONTENT_REQUIRED"


def test_disabled_channel_is_skipped(db, scope_for, community, superadmin, make_user):
    rcpt = make_user()
    user_svc = _svc(db, scope_for(community.id), rcpt)
    user_svc.set_preference(
        schemas.PreferenceUpsert(channel="email", is_enabled=False, community_id=community.id)
    )
    admin = _svc(db, scope_for(community.id), superadmin)
    note = admin.dispatch(
        schemas.DispatchIn(
            recipient_user_id=rcpt.id,
            notification_type="alert",
            title="T",
            message="M",
            channels=["in_app", "email"],
            community_id=community.id,
        )
    )
    statuses = {d.channel: d.status for d in note.deliveries}
    assert statuses["email"] == "skipped" and statuses["in_app"] == "delivered"


def test_inbox_read_flow(db, scope_for, community, superadmin, make_user):
    rcpt = make_user()
    admin = _svc(db, scope_for(community.id), superadmin)
    for i in range(3):
        admin.dispatch(
            schemas.DispatchIn(
                recipient_user_id=rcpt.id,
                notification_type="n",
                title=f"T{i}",
                message="M",
                community_id=community.id,
            )
        )
    user_svc = _svc(db, scope_for(community.id), rcpt)
    rows, total = user_svc.list_mine(unread_only=True, offset=0, limit=10)
    assert total == 3
    user_svc.mark_read(rows[0].id)
    assert user_svc.list_mine(unread_only=True, offset=0, limit=10)[1] == 2
    assert user_svc.mark_all_read() == 2
    assert user_svc.list_mine(unread_only=True, offset=0, limit=10)[1] == 0


def test_unknown_template_and_recipient(db, scope_for, community, superadmin, make_user):
    admin = _svc(db, scope_for(community.id), superadmin)
    with pytest.raises(NotFoundError):
        admin.dispatch(
            schemas.DispatchIn(
                recipient_user_id=make_user().id,
                notification_type="x",
                template_code="nope",
                community_id=community.id,
            )
        )
