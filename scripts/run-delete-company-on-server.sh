#!/bin/bash
# Запуск на сервере из /opt/flamecrm:
#   bash scripts/run-delete-company-on-server.sh 201540
set -e
cd "$(dirname "$0")/.."
COMPANY_ID="${1:-201540}"
export DATABASE_URL=$(grep '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)
docker run --rm --network flamecrm_default \
  -v "$(pwd):/app" -w /app \
  -e DATABASE_URL="$DATABASE_URL" \
  node:20-alpine \
  sh -c 'npm install && npx prisma generate && node scripts/delete-company-by-id.js '"$COMPANY_ID"
