#!/bin/bash
# Run on server: cd /opt/flamecrm && bash scripts/server-deploy.sh
# Or via SSH: ssh root@79.143.30.96 "cd /opt/flamecrm && bash scripts/server-deploy.sh"
set -e
cd /opt/flamecrm
# Чтобы редиректы из писем (подтверждение email) вели на https://flamecrm.ru, а не на 0.0.0.0
if [ -f .env ]; then
  grep -q '^NEXTAUTH_URL=' .env || echo 'NEXTAUTH_URL=https://flamecrm.ru' >> .env
fi
git pull origin main
docker-compose down
docker-compose build --no-cache app
docker-compose up -d
sleep 15
docker-compose exec -T app npx -y prisma@6.19.0 migrate deploy
docker-compose ps
echo "=== Deploy done ==="
