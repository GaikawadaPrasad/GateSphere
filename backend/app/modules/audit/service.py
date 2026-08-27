"""Business logic for Audit Logging.

Rules live here: permission checks beyond role gates, state transitions, invariants,
transaction orchestration, event emission. Depends on repository, never on FastAPI.
"""
