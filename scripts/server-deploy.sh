#!/bin/bash
# Run on server: cd /opt/flamecrm && bash scripts/server-deploy.sh
# Or via SSH: ssh root@79.143.30.96 "cd /opt/flamecrm && bash scripts/server-deploy.sh"
set -e
cd /opt/flamecrm

# Обязательный бэкап БД перед любым деплоем (см. scripts/SERVER-DATABASE-RULES.md)
if [ -f scripts/backup-db.sh ]; then
  echo "=== Создание бэкапа БД перед деплоем ==="
  bash scripts/backup-db.sh || { echo "ОШИБКА: не удалось создать бэкап. Деплой прерван."; exit 1; }
fi

# Чтобы редиректы из писем (подтверждение email) вели на https://flamecrm.ru, а не на 0.0.0.0
if [ -f .env ]; then
  grep -q '^NEXTAUTH_URL=' .env || echo 'NEXTAUTH_URL=https://flamecrm.ru' >> .env
fi
git pull origin main

# Используем docker compose (v2), fallback на docker-compose (v1)
if docker compose version &>/dev/null; then
  DC="docker compose"
else
  DC="docker-compose"
fi

$DC down
$DC build --no-cache app
$DC up -d
sleep 15
$DC exec -T app npx -y prisma@6.19.0 migrate deploy
$DC ps
echo "=== Deploy done ==="
