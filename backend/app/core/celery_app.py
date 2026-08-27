"""Celery application. Worker entrypoint: `celery -A app.core.celery_app.celery worker`."""

from __future__ import annotations

from celery import Celery

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
    ],
)
celery.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_track_started=True,
    timezone="UTC",
    beat_schedule={
        # "generate-monthly-invoices": {
        #     "task": "app.modules.billing.tasks.generate_monthly_invoices",
        #     "schedule": crontab(day_of_month=1, hour=2, minute=0),
        # },
    },
)
