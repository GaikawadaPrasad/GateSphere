# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements.lock.txt ./
RUN pip install --upgrade pip && pip install --require-hashes -r requirements.lock.txt

COPY . .

RUN chmod +x /app/scripts/entrypoint.sh \
 && groupadd --gid 1000 appuser \
 && useradd --uid 1000 --gid appuser --no-create-home --shell /usr/sbin/nologin appuser \
 && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000
ENTRYPOINT ["/app/scripts/entrypoint.sh"]
CMD ["api"]
