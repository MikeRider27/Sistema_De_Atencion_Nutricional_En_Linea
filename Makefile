.PHONY: setup up down logs test psql reset

setup:  ## Crea .env con secretos aleatorios
	./setup.sh

up:     ## Construye y levanta todo
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

test:   ## Pruebas del backend contra una BD efímera
	docker compose --profile test run --rm --build tests; \
	rc=$$?; docker compose --profile test rm -sf db-test >/dev/null 2>&1; exit $$rc

psql:   ## Consola SQL
	docker compose exec db sh -c 'psql -U $$POSTGRES_USER $$POSTGRES_DB'

reset:  ## BORRA los datos y recrea la base (re-ejecuta db/init)
	docker compose down -v && docker compose up -d --build
