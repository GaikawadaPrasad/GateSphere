"""Pydantic models for the realtime channel."""

from __future__ import annotations

from pydantic import BaseModel


class TicketRead(BaseModel):
    ticket: str
    expires_in: int
