#!/usr/bin/env bash
# GateSphere — single-command API test run (Postman collection via Newman).
#
#   scripts/test-api.sh            # against the docker compose stack
#   BASE_URL=https://staging... scripts/test-api.sh --no-stack   # against a remote target
#
# Exits non-zero if any Newman assertion fails. Newman is NOT bundled — see the check below.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PM="$ROOT/docs/postman"
COLLECTION="$PM/GateSphere_API.postman_collection.json"
ENVFILE="$PM/gate_sphere.postman_environment.json"
BASE_URL="${BASE_URL:-http://localhost:8001}"
MANAGE_STACK=1
[[ "${1:-}" == "--no-stack" ]] && MANAGE_STACK=0

command -v newman >/dev/null 2>&1 || NEWMAN="npx --yes newman"
NEWMAN="${NEWMAN:-newman}"
if ! $NEWMAN --version >/dev/null 2>&1; then
  echo "Newman not found. Install it:  npm install -g newman   (or ensure 'npx' is available)" >&2
  exit 127
fi

if [[ "$MANAGE_STACK" == "1" ]]; then
  echo ">> bringing up the stack with a relaxed login rate limit"
  ( cd "$ROOT" && RATE_LIMIT_LOGIN="1000/minute" docker compose up -d db redis minio backend worker beat )
fi

echo ">> waiting for $BASE_URL/healthz"
for _ in $(seq 1 60); do
  curl -sf -o /dev/null "$BASE_URL/healthz" && break
  sleep 2
done
curl -sf -o /dev/null "$BASE_URL/healthz" || { echo "backend not healthy at $BASE_URL" >&2; exit 1; }

echo ">> running Newman"
set +e
$NEWMAN run "$COLLECTION" -e "$ENVFILE" \
  --env-var "base_url=$BASE_URL" \
  --reporters cli,json \
  --reporter-json-export "$PM/newman-report.json"
CODE=$?
set -e

if [[ "$MANAGE_STACK" == "1" ]]; then
  # The _Workflow folder writes real rows to the shared DB — reseed so the next
  # `make test` (pytest) starts from clean seed data (IS-1), and restore the rate limit.
  ( cd "$ROOT" && docker compose run --rm backend seed --reset >/dev/null 2>&1 || true )
  ( cd "$ROOT" && docker compose up -d backend >/dev/null 2>&1 )
fi

echo ">> report: $PM/newman-report.json"
exit $CODE
