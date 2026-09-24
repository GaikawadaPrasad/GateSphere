"""Shared constants used across modules (AGENTS.md §19: never duplicate a constant)."""

from __future__ import annotations

# A 10-digit Indian mobile number, digits only — no country code, spaces or dashes (GS-016).
PHONE_10_DIGIT_PATTERN = r"^\d{10}$"

# Minimum length for any password a user *sets* (create / change / reset / invitation
# accept). Login and current-password fields accept any length so the uniform
# "Invalid email or password" response is preserved (re-audit #3, S-12).
PASSWORD_MIN_LENGTH = 10
