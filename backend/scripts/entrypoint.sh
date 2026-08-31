#!/usr/bin/env bash
# Backend container entrypoint. First arg selects the process.
set -euo pipefail

wait_for() {
  python - "$1" "$2" <<'PY'
import socket, sys, time
host, port = sys.argv[1], int(sys.argv[2])
for _ in range(60):
    try:
        socket.create_connection((host, port), timeout=2).close()
        sys.exit(0)
    except OSError:
        time.sleep(1)
sys.exit(f"timeout waiting for {host}:{port}")
PY
}

wait_for "${POSTGRES_HOST:-db}" "${POSTGRES_PORT:-5432}"
wait_for "${REDIS_HOST:-redis}" "${REDIS_PORT:-6379}"

case "${1:-api}" in
  api)
    alembic upgrade head
    if [ "${SEED_ON_START:-false}" = "true" ]; then python -m app.scripts.seed || true; fi
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ;;
  api-prod)
    alembic upgrade head
    exec gunicorn app.main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 --workers "${WEB_CONCURRENCY:-3}"
    ;;
  worker)
    exec celery -A app.core.celery_app.celery worker --loglevel=INFO -Q default,email,notifications,reports,maintenance
    ;;
  beat)
    exec celery -A app.core.celery_app.celery beat --loglevel=INFO
    ;;
  migrate)
    exec alembic upgrade head
    ;;
  seed)
    shift
    exec python -m app.scripts.seed "$@"
    ;;
  *)
    exec "$@"
    ;;
esac
