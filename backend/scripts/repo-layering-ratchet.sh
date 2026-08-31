#!/usr/bin/env bash
# C-3 layering ratchet: services still hold SQLAlchemy `select()` for read queries
# (tracked debt). New query logic belongs in `<module>/repository.py`, not the service.
# This fails only if the count of `select(`-bearing lines in `app/modules/*/service.py`
# GREW vs backend/.repo-layering-baseline.
#
# When you move a query into a repository, lower the baseline:
#   scripts/repo-layering-ratchet.sh --update
#
# Reference module: `app/modules/communities/` — service delegates every read to
# `CommunityRepository`; copy that shape when adding queries elsewhere.
set -uo pipefail
cd "$(dirname "$0")/.."
BASE_FILE=".repo-layering-baseline"

COUNT="$(grep -c 'select(' app/modules/*/service.py 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')"
COUNT="${COUNT:-0}"
BASE="$(tr -dc '0-9' < "$BASE_FILE" 2>/dev/null || echo 0)"
BASE="${BASE:-0}"
echo "service-layer select() lines: ${COUNT}   baseline: ${BASE}"

if [ "${1:-}" = "--update" ]; then
  printf '%s\n' "$COUNT" > "$BASE_FILE"
  echo "baseline updated to $COUNT"
  exit 0
fi

if [ "$COUNT" -gt "$BASE" ]; then
  echo "::error:: service-layer raw-query count increased (${BASE} -> ${COUNT}). Put the new query in <module>/repository.py (see app/modules/communities/), or run scripts/repo-layering-ratchet.sh --update if intentional." >&2
  exit 1
fi
if [ "$COUNT" -lt "$BASE" ]; then
  echo "::notice:: layering improved (${BASE} -> ${COUNT}) — run scripts/repo-layering-ratchet.sh --update to lock it in."
fi
