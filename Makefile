# GateSphere local dev shortcuts. Requires Docker Desktop.
COMPOSE = docker compose

.PHONY: help init up down logs ps restart build seed seed-reset migrate revision \
        backend-sh psql redis-cli test lint format fmt-check clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

init: ## First-time setup: create .env files
	@test -f .env || cp .env.example .env
	@test -f backend/.env || cp backend/.env.example backend/.env
	@test -f frontend/.env.local || cp frontend/.env.example frontend/.env.local
	@echo "Created .env files. Now run: make up"

up: ## Build + start the whole stack
	$(COMPOSE) up --build -d
	@echo "Frontend  http://localhost:3000"
	@echo "API docs  http://localhost:8000/docs"
	@echo "MinIO     http://localhost:9001  (gatesphere / gatesphere-secret)"

down: ## Stop the stack
	$(COMPOSE) down

clean: ## Stop and delete volumes (DB, object storage)
	$(COMPOSE) down -v

logs: ## Tail all logs
	$(COMPOSE) logs -f

ps: ## Show container status
	$(COMPOSE) ps

restart: ## Restart backend + workers
	$(COMPOSE) restart backend worker beat

build: ## Rebuild images
	$(COMPOSE) build

migrate: ## Apply DB migrations
	$(COMPOSE) run --rm backend migrate

revision: ## Autogenerate a migration:  make revision m="add visitors table"
	$(COMPOSE) run --rm backend alembic revision --autogenerate -m "$(m)"

seed: ## (Re)load synthetic seed data (idempotent top-up)
	$(COMPOSE) run --rm backend seed

seed-reset: ## Wipe every data table, then reseed from clean (safe DB reset)
	$(COMPOSE) run --rm backend seed --reset

test: ## Run backend tests against a freshly reseeded DB (deterministic; see docs/backend/TESTING.md)
	$(COMPOSE) stop worker beat >/dev/null 2>&1 || true
	$(COMPOSE) run --rm backend seed --reset
	$(COMPOSE) run --rm backend pytest
	$(COMPOSE) start worker beat >/dev/null 2>&1 || true

test-fast: ## Run backend tests without reseeding (fast; may flake on accumulated data — see IS-1)
	$(COMPOSE) run --rm backend pytest

lint: ## Ruff + Black check (backend) and ESLint (frontend)
	$(COMPOSE) run --rm backend sh -c "ruff check . && black --check ."
	$(COMPOSE) run --rm frontend npm run lint

format: ## Auto-format backend + frontend
	$(COMPOSE) run --rm backend sh -c "ruff check --fix . && black ."
	$(COMPOSE) run --rm frontend npm run format

backend-sh: ## Shell into the backend container
	$(COMPOSE) exec backend bash

psql: ## Open psql
	$(COMPOSE) exec db psql -U gatesphere

redis-cli: ## Open redis-cli
	$(COMPOSE) exec redis redis-cli
