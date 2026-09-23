"""M-02 (backend/REMEDIATION_LOG.md): a notification dispatch/broadcast-enqueue failure
used to be logged and then unrecoverable. It now persists a `NotificationDeadLetter` row
that `app.modules.notifications.tasks.retry_dead_letters` replays on a schedule.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.notifications import events as notif_events
from app.modules.notifications import tasks as dl_tasks
from app.modules.notifications.models import Notification, NotificationDeadLetter


async def test_emit_failure_writes_dead_letter_and_does_not_raise(
    db, scope_for, community, superadmin
):
    """A recipient that doesn't exist makes NotificationService.dispatch raise
    NotFoundError inside emit()'s SAVEPOINT. Before this fix that was only logged;
    now it must also leave an unresolved dead-letter row, and — critically — must not
    propagate, since notifications must never break the caller's own transaction."""
    scope = scope_for(community.id)
    bogus_recipient = uuid.uuid4()
    await notif_events.emit(
        db,
        scope,
        superadmin,
        None,
        recipient_user_id=bogus_recipient,
        community_id=community.id,
        notification_type="probe.failure",
        title="T",
        message="M",
    )  # must not raise

    row = await db.scalar(
        select(NotificationDeadLetter).where(
            NotificationDeadLetter.notification_type == "probe.failure"
        )
    )
    assert row is not None
    assert row.kind == "single"
    assert row.resolved_at is None
    assert row.community_id == community.id
    assert row.payload["recipient_user_id"] == str(bogus_recipient)
    assert (
        await db.scalar(
            select(Notification).where(Notification.recipient_user_id == bogus_recipient)
        )
        is None
    )


async def test_emit_many_failure_writes_dead_letter(db, scope_for, community):
    """A title longer than Notification.title's column limit makes the bulk INSERT
    fail with a DataError. Must dead-letter, not raise, and return 0 delivered."""
    recipients = [uuid.uuid4()]
    delivered = await notif_events.emit_many(
        db,
        recipient_user_ids=recipients,
        community_id=community.id,
        notification_type="probe.bulk_failure",
        title="T" * 500,  # Notification.title is String(300)
        message="M",
    )
    assert delivered == 0

    row = await db.scalar(
        select(NotificationDeadLetter).where(
            NotificationDeadLetter.notification_type == "probe.bulk_failure"
        )
    )
    assert row is not None
    assert row.kind == "bulk"
    assert row.payload["recipient_user_ids"] == [str(recipients[0])]


async def test_retry_dead_letters_resolves_single():
    """End-to-end against real committed rows (retry_dead_letters uses its own fresh
    session via job_session(), so this needs data visible across connections — the
    rollback-backed `db` fixture doesn't qualify). Create a real recipient + a dead
    letter referencing them, run the retry body, and confirm it resolves and actually
    delivers the notification."""
    with SessionLocal() as sync_db:
        from app.modules.communities.models import Community
        from app.modules.users.models import User

        community = sync_db.scalar(select(Community).limit(1))
        recipient = User(
            email=f"dl-{uuid.uuid4().hex[:10]}@example.test",
            full_name="Dead Letter Recipient",
            password_hash="x",
        )
        sync_db.add(recipient)
        sync_db.flush()
        from app.modules.residents.models import ResidentProfile

        prof = ResidentProfile(
            community_id=community.id, user_id=recipient.id, profile_status="active"
        )
        sync_db.add(prof)
        sync_db.flush()
        dl = NotificationDeadLetter(
            community_id=community.id,
            kind="single",
            notification_type="probe.retry",
            payload={
                "recipient_user_id": str(recipient.id),
                "title": "Retried",
                "message": "This was retried",
                "reference_type": None,
                "reference_id": None,
                "channels": ["in_app"],
            },
            failure_reason="simulated outage",
            attempts=1,
            last_attempted_at=datetime.now(UTC),
        )
        sync_db.add(dl)
        sync_db.commit()
        dl_id, recipient_id = dl.id, recipient.id

    try:
        result = await dl_tasks._retry_dead_letters()
        assert result["resolved"] >= 1, result

        with SessionLocal() as sync_db:
            refreshed = sync_db.get(NotificationDeadLetter, dl_id)
            assert refreshed.resolved_at is not None
            note = sync_db.scalar(
                select(Notification).where(
                    Notification.recipient_user_id == recipient_id,
                    Notification.notification_type == "probe.retry",
                )
            )
            assert note is not None
            assert note.title == "Retried"
    finally:
        with SessionLocal() as sync_db:
            for row in sync_db.scalars(
                select(Notification).where(Notification.recipient_user_id == recipient_id)
            ).all():
                sync_db.delete(row)
            dl_row = sync_db.get(NotificationDeadLetter, dl_id)
            if dl_row is not None:
                sync_db.delete(dl_row)
            from app.modules.users.models import User

            user_row = sync_db.get(User, recipient_id)
            if user_row is not None:
                sync_db.delete(user_row)
            sync_db.commit()


async def test_retry_dead_letters_keeps_failing_row_unresolved():
    """A dead letter whose recipient no longer exists must fail again on retry — the
    row stays unresolved, attempts increments, and the failure doesn't crash the sweep
    (other rows in the same batch must still be processed)."""
    with SessionLocal() as sync_db:
        from app.modules.communities.models import Community

        community = sync_db.scalar(select(Community).limit(1))
        dl = NotificationDeadLetter(
            community_id=community.id,
            kind="single",
            notification_type="probe.retry_still_broken",
            payload={
                "recipient_user_id": str(uuid.uuid4()),  # nobody — dispatch() 404s again
                "title": "T",
                "message": "M",
                "reference_type": None,
                "reference_id": None,
                "channels": ["in_app"],
            },
            failure_reason="simulated outage",
            attempts=1,
            last_attempted_at=datetime.now(UTC),
        )
        sync_db.add(dl)
        sync_db.commit()
        dl_id = dl.id

    try:
        result = await dl_tasks._retry_dead_letters()
        assert result["still_failing"] >= 1, result

        with SessionLocal() as sync_db:
            refreshed = sync_db.get(NotificationDeadLetter, dl_id)
            assert refreshed.resolved_at is None
            assert refreshed.attempts == 2
    finally:
        with SessionLocal() as sync_db:
            dl_row = sync_db.get(NotificationDeadLetter, dl_id)
            if dl_row is not None:
                sync_db.delete(dl_row)
            sync_db.commit()
