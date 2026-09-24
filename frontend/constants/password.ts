// Mirrors backend `app/core/constants.py::PASSWORD_MIN_LENGTH` — the server's 422 remains
// the source of truth; this only saves an obvious round trip (AGENTS.md §5.6).
export const PASSWORD_MIN_LENGTH = 10;
