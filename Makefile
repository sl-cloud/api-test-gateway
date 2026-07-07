.PHONY: up up-shared down logs test test-unit test-integration reset migrate lint format typecheck

up:
	docker compose up -d --wait

up-shared:
	docker compose -f docker-compose.yml -f docker-compose.shared-net.yml up -d --wait

down:
	docker compose down

logs:
	docker compose logs -f

test:
	npm test

test-unit:
	npm run test:unit

test-integration:
	npm run test:integration

migrate:
	npm run migrate

lint:
	npm run lint

format:
	npm run format

typecheck:
	npm run typecheck

reset:
	docker compose down -v
	docker compose up -d --wait
