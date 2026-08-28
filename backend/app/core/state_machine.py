"""Shared workflow state-machine helpers.

A lifecycle enum's transition map lives next to its service. `ensure_transition` is the one
gate every state change passes through: it rejects an unknown transition, a terminal-state
transition, and (optionally) a no-op. Routers stay thin; repositories never call this.

    _TICKET = {
        "created": {"assigned", "cancelled"},
        "assigned": {"acknowledged", "in_progress", "cancelled"},
        ...
        "closed": set(),
    }
    ensure_transition(ticket.status, target, _TICKET)   # raises BusinessRuleError on a bad move
"""

from __future__ import annotations

from collections.abc import Mapping, Set

from app.core.errors import BusinessRuleError

TransitionMap = Mapping[str, Set[str]]


def can_transition(current: str, target: str, allowed: TransitionMap) -> bool:
    return target in allowed.get(current, set())


def is_terminal(state: str, allowed: TransitionMap) -> bool:
    return not allowed.get(state)


def ensure_transition(
    current: str,
    target: str,
    allowed: TransitionMap,
    *,
    entity: str = "record",
    allow_noop: bool = False,
    code: str = "INVALID_TRANSITION",
) -> None:
    """Raise `BusinessRuleError` unless `current -> target` is a declared transition.

    `allow_noop=True` makes `current == target` a silent pass (for idempotent endpoints).
    """
    if current == target:
        if allow_noop:
            return
        raise BusinessRuleError(
            f"{entity.capitalize()} is already '{current}'",
            code=code,
            fields={"status": f"already {current}"},
        )
    if is_terminal(current, allowed):
        raise BusinessRuleError(
            f"{entity.capitalize()} is in the terminal state '{current}'",
            code=code,
            fields={"status": f"'{current}' is terminal"},
        )
    if not can_transition(current, target, allowed):
        raise BusinessRuleError(
            f"Cannot move a '{current}' {entity} to '{target}'",
            code=code,
            fields={"status": f"one of {sorted(allowed.get(current, set()))}"},
        )
