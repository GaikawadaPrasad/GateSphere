"""Transactional email abstraction.

Backends:
  * console : logs the message (default for local dev / tests)
  * brevo   : sends via Brevo (Sendinblue) transactional API

Call sites should go through `send_email(...)`; templating lives in the notifications module.
"""

from __future__ import annotations

import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)


def send_email(to: str, subject: str, html: str, *, to_name: str | None = None) -> None:
    if settings.EMAIL_BACKEND == "console" or not settings.BREVO_API_KEY:
        log.info("email.console", to=to, subject=subject, html_len=len(html))
        return
    _send_brevo(to=to, to_name=to_name or to, subject=subject, html=html)


def _send_brevo(*, to: str, to_name: str, subject: str, html: str) -> None:
    import sib_api_v3_sdk
    from sib_api_v3_sdk.rest import ApiException

    cfg = sib_api_v3_sdk.Configuration()
    cfg.api_key["api-key"] = settings.BREVO_API_KEY
    api = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(cfg))
    payload = sib_api_v3_sdk.SendSmtpEmail(
        sender={"email": settings.EMAIL_FROM, "name": settings.EMAIL_FROM_NAME},
        to=[{"email": to, "name": to_name}],
        subject=subject,
        html_content=html,
    )
    try:
        api.send_transac_email(payload)
        log.info("email.brevo.sent", to=to, subject=subject)
    except ApiException:
        log.exception("email.brevo.failed", to=to, subject=subject)
        raise
