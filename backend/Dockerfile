# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HOME=/app

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl \
 && rm -rf /var/lib/apt/lists/*

# Runtime-only lock by default (no pytest/black/ruff/mypy in the production image).
# The local docker-compose stack passes REQUIREMENTS=requirements-dev.lock.txt so
# `make test` / `make lint` work inside the container.
ARG REQUIREMENTS=requirements.lock.txt
COPY requirements.txt requirements.lock.txt requirements-dev.lock.txt ./
RUN pip install --upgrade pip && pip install --require-hashes -r "${REQUIREMENTS}"

RUN useradd -m -d /app -s /bin/bash appuser && chown -R appuser:appuser /app
USER appuser

COPY --chown=appuser:appuser . .

RUN chmod +x /app/scripts/entrypoint.sh

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/healthz || exit 1

ENTRYPOINT ["/app/scripts/entrypoint.sh"]
CMD ["api-prod"]
