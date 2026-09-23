"""Shared constants used across modules (AGENTS.md §19: never duplicate a constant)."""

from __future__ import annotations

# A 10-digit Indian mobile number, digits only — no country code, spaces or dashes (GS-016).
PHONE_10_DIGIT_PATTERN = r"^\d{10}$"
