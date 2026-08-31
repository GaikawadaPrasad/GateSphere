"""Pydantic models for Communication & Broadcasts (FR-12). Write bodies are `extra="forbid"`."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.modules.communication.models import ANNOUNCEMENT_TYPES, POLL_STATUS, PRIORITIES

ALLOWED = {
    "announcement_type": set(ANNOUNCEMENT_TYPES),
    "priority": set(PRIORITIES),
    "poll_status": set(POLL_STATUS),
}


class _Write(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class _Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# -- targets ---------------------------------------------------- #
class TargetIn(_Write):
    tower_id: uuid.UUID | None = None
    unit_id: uuid.UUID | None = None
    role_id: uuid.UUID | None = None
    resident_group_id: uuid.UUID | None = None
    target_all_community: bool = False

    @model_validator(mode="after")
    def _valid(self) -> TargetIn:
        if not (
            self.target_all_community
            or self.tower_id
            or self.unit_id
            or self.role_id
            or self.resident_group_id
        ):
            raise ValueError("target must set tower_id / unit_id / role_id / group / all")
        return self


class TargetRead(_Read):
    announcement_id: uuid.UUID
    tower_id: uuid.UUID | None
    unit_id: uuid.UUID | None
    role_id: uuid.UUID | None
    resident_group_id: uuid.UUID | None
    target_all_community: bool


# -- resident groups ------------------------------------------- #
class GroupCreate(_Write):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)


class GroupUpdate(_Write):
    name: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    is_active: bool | None = None


class GroupRead(_Read):
    community_id: uuid.UUID
    name: str
    description: str | None
    created_by_user_id: uuid.UUID | None
    is_active: bool
    member_count: int = 0


class GroupMemberIn(_Write):
    user_id: uuid.UUID


class GroupMemberRead(_Read):
    group_id: uuid.UUID
    user_id: uuid.UUID
    added_at: datetime


# -- announcements ----------------------------------------- #
class AnnouncementCreate(_Write):
    announcement_type: str = "notice"
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=20000)
    priority: str = "normal"
    publish_at: datetime | None = None
    expires_at: datetime | None = None
    event_start_at: datetime | None = None
    event_end_at: datetime | None = None
    targets: list[TargetIn] = Field(default_factory=list)


class AnnouncementUpdate(_Write):
    title: str | None = Field(default=None, max_length=200)
    body: str | None = Field(default=None, max_length=20000)
    priority: str | None = None
    publish_at: datetime | None = None
    expires_at: datetime | None = None
    event_start_at: datetime | None = None
    event_end_at: datetime | None = None
    targets: list[TargetIn] | None = None


class AnnouncementRead(_Read):
    community_id: uuid.UUID
    created_by_user_id: uuid.UUID | None
    announcement_type: str
    title: str
    body: str
    priority: str
    publish_at: datetime | None
    expires_at: datetime | None
    event_start_at: datetime | None
    event_end_at: datetime | None
    is_published: bool
    targets: list[TargetRead] = []


# -- polls ------------------------------------------------ #
class PollOptionIn(_Write):
    option_text: str = Field(min_length=1, max_length=200)
    display_order: int = 0


class PollCreate(_Write):
    announcement_id: uuid.UUID
    question: str = Field(min_length=1, max_length=400)
    allow_multiple: bool = False
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    options: list[PollOptionIn] = Field(min_length=2)


class PollOptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    option_text: str
    display_order: int


class PollRead(_Read):
    community_id: uuid.UUID
    announcement_id: uuid.UUID
    question: str
    allow_multiple: bool
    opens_at: datetime | None
    closes_at: datetime | None
    status: str
    options: list[PollOptionRead] = []


class VoteIn(_Write):
    option_ids: list[uuid.UUID] = Field(min_length=1)


class PollResultRow(BaseModel):
    option_id: uuid.UUID
    option_text: str
    votes: int


class PollResults(BaseModel):
    poll_id: uuid.UUID
    total_responses: int
    results: list[PollResultRow]


class SurveyQuestionResults(BaseModel):
    poll_id: uuid.UUID
    question: str
    status: str
    allow_multiple: bool
    total_responses: int
    results: list[PollResultRow]


class SurveyRead(BaseModel):
    announcement_id: uuid.UUID
    title: str
    question_count: int
    questions: list[SurveyQuestionResults]


class RsvpIn(_Write):
    response: str = Field(pattern="^(going|maybe|not_going)$")
    guests: int = Field(default=0, ge=0, le=20)
    note: str | None = Field(default=None, max_length=500)


class RsvpRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    response: str
    guests: int
    note: str | None


class RsvpSummary(BaseModel):
    going: int
    maybe: int
    not_going: int
    total_attendees: int
    my_response: str | None
    responses: list[RsvpRead]
