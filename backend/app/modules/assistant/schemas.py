"""Pydantic schemas for the Assistant / Chatbot module."""

from __future__ import annotations

import uuid
from pydantic import BaseModel, ConfigDict, Field


class AssistantAction(BaseModel):
    """Action button or link returned with an assistant response."""
    label: str
    url: str
    action_type: str = "navigate"  # navigate | action


class AssistantQuickChip(BaseModel):
    """Quick prompt chip displayed above the assistant input box."""
    id: str
    icon: str
    label: str
    query: str


class AssistantQueryRequest(BaseModel):
    """Input payload for querying the assistant."""
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    community_id: uuid.UUID | None = None
    query: str = Field(..., min_length=1, max_length=1000, description="User query or FAQ question")


class AssistantResponse(BaseModel):
    """Structured response from the assistant."""
    reply_text: str
    category: str
    actions: list[AssistantAction] = []
    related_faqs: list[str] = []


class AssistantQuickActionsResponse(BaseModel):
    """Quick starter prompts and greeting tailored to the caller's role."""
    community_id: uuid.UUID
    greeting: str
    chips: list[AssistantQuickChip]
    suggested_queries: list[str]
