#!/usr/bin/env bash
# Fail only if the mypy error count GREW vs backend/.mypy-baseline (TYP-1).
# When you fix type errors, lower the baseline: `scripts/mypy-ratchet.sh --update`.
set -uo pipefail
cd "$(dirname "$0")/.."
BASE_FILE=".mypy-baseline"

OUT="$(mypy app 2>&1 || true)"
COUNT="$(printf '%s\n' "$OUT" | sed -n 's/^Found \([0-9]\+\) error.*/\1/p' | head -1)"
COUNT="${COUNT:-0}"
BASE="$(tr -dc '0-9' < "$BASE_FILE" 2>/dev/null || echo 0)"
BASE="${BASE:-0}"
echo "mypy errors: ${COUNT}   baseline: ${BASE}"

if [ "${1:-}" = "--update" ]; then
  printf '%s\n' "$COUNT" > "$BASE_FILE"
  echo "baseline updated to $COUNT"
  exit 0
fi

if [ "$COUNT" -gt "$BASE" ]; then
  echo "::error:: mypy error count increased (${BASE} -> ${COUNT}). Fix the new type errors, or run scripts/mypy-ratchet.sh --update if intentional." >&2
  exit 1
fi
if [ "$COUNT" -lt "$BASE" ]; then
  echo "::notice:: mypy improved (${BASE} -> ${COUNT}) — run scripts/mypy-ratchet.sh --update to lock it in."
fi
