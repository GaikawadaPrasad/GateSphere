"""Celery application. Worker entrypoint: `celery -A app.core.celery_app.celery worker`."""

from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery = Celery(
    "gatesphere",
    broker=str(settings.CELERY_BROKER_URL),
    backend=str(settings.CELERY_RESULT_BACKEND),
    include=[
        "app.modules.notifications.tasks",
        "app.modules.billing.tasks",
        "app.modules.visitors.tasks",
        "app.modules.complaints.tasks",
        "app.modules.amenities.tasks",
    ],
)
celery.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_track_started=True,
    timezone="UTC",
    beat_schedule={
        "sweep-ticket-sla": {
            "task": "app.modules.complaints.tasks.sweep_ticket_sla",
            "schedule": 300.0,  # every 5 min — SLA at-risk / breach / escalation
        },
        "sweep-overdue-invoices": {
            "task": "app.modules.billing.tasks.sweep_overdue_invoices",
            "schedule": crontab(hour=1, minute=0),
        },
        "send-dues-reminders": {
            "task": "app.modules.billing.tasks.send_dues_reminders",
            "schedule": crontab(day_of_week="mon", hour=9, minute=0),
        },
        "expire-visitor-requests": {
            "task": "app.modules.visitors.tasks.expire_stale_requests",
            "schedule": 900.0,  # every 15 min
        },
        "close-past-amenity-bookings": {
            "task": "app.modules.amenities.tasks.close_past_bookings",
            "schedule": 900.0,
        },
    },
)
