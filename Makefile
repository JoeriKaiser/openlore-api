.PHONY: help up down logs migrate seed shell db-shell build restart clean

help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

up: ## Start all containers in detached mode
	docker compose up -d

down: ## Stop all containers
	docker compose down

logs: ## Tail logs from all containers
	docker compose logs -f

migrate: ## Run database migrations inside the API container
	docker compose exec openlore-api bun run migrate

seed: ## Seed the database with sample data
	docker compose exec openlore-api bun run seed

shell: ## Open a shell in the API container
	docker compose exec openlore-api /bin/sh

db-shell: ## Open a PostgreSQL shell
	docker compose exec postgres psql -U openlore -d openlore

build: ## Rebuild all containers
	docker compose build

restart: ## Restart all containers
	docker compose restart

clean: ## Stop containers and remove volumes
	docker compose down -v

dev: ## Start containers and tail logs
	docker compose up

install: ## Install dependencies inside the container
	docker compose exec openlore-api bun install

db-generate: ## Generate new migration from schema changes
	docker compose exec openlore-api bun run db:generate

reindex: ## Reindex all RAG data (requires user interaction)
	@echo "This should be called via API endpoint POST /api/rag/reindex with authentication"
