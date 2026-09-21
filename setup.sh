#!/usr/bin/env bash
# Prepara .env con secretos aleatorios (sólo si aún no existe).
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then
  echo "✔ .env ya existe; no se modifica."
else
  cp .env.example .env
  pw=$(openssl rand -hex 16)
  secret=$(openssl rand -hex 32)
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${pw}|; s|^JWT_SECRET=.*|JWT_SECRET=${secret}|" .env
  echo "✔ .env creado con secretos aleatorios."
fi

echo
echo "Siguiente paso:  docker compose up -d --build"
echo "  Frontend:  http://localhost:$(grep -E '^FRONTEND_PORT=' .env | cut -d= -f2)"
echo "  API docs:  http://localhost:$(grep -E '^BACKEND_PORT=' .env | cut -d= -f2)/docs"
