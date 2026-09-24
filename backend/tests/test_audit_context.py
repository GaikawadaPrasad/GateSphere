"""Every audit write carries its actor context (re-audit #4, Finding 3 residual).

`record_audit_async` / `record_audit` accept `ctx=None` so an audit write can never break the
business operation at runtime. That leaves a gap only if a call site passes neither a request
context nor an explicit marker (`role_slug="system"` for scheduled jobs). This test closes it
statically: a new call site without either fails CI instead of silently writing context-less
audit rows.
"""

from __future__ import annotations

import ast
import pathlib

_APP = pathlib.Path(__file__).resolve().parents[1] / "app"
_AUDIT_FUNCS = {"record_audit_async", "record_audit"}


def _call_name(node: ast.Call) -> str | None:
    if isinstance(node.func, ast.Name):
        return node.func.id
    if isinstance(node.func, ast.Attribute):
        return node.func.attr
    return None


def _missing_context_calls() -> list[str]:
    missing: list[str] = []
    for path in _APP.rglob("*.py"):
        if "tests" in path.parts:
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call) or _call_name(node) not in _AUDIT_FUNCS:
                continue
            kwargs = {kw.arg: kw.value for kw in node.keywords}
            if None in kwargs:  # `**kw` pass-through wrapper: its own callers are checked
                continue
            ctx = kwargs.get("ctx")
            has_ctx = ctx is not None and not (isinstance(ctx, ast.Constant) and ctx.value is None)
            if not has_ctx and "role_slug" not in kwargs:
                missing.append(f"{path.relative_to(_APP.parent)}:{node.lineno}")
    return missing


def test_every_audit_call_passes_ctx_or_role_slug() -> None:
    missing = _missing_context_calls()
    assert not missing, (
        "audit call(s) without ctx= or role_slug= (system jobs pass role_slug='system'): "
        + ", ".join(sorted(missing))
    )


def test_scan_actually_finds_audit_calls() -> None:
    """Guard against the scan silently matching nothing (a vacuous pass)."""
    count = sum(
        1
        for path in _APP.rglob("*.py")
        if "tests" not in path.parts
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8")))
        if isinstance(node, ast.Call) and _call_name(node) in _AUDIT_FUNCS
    )
    assert count > 20
