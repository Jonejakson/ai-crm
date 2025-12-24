#!/bin/bash
ssh -i ~/.ssh/id_ed25519_selectel root@79.143.30.96 << 'ENDSSH'
cd /opt/ai-crm

echo "========================================"
echo "ОБНОВЛЕНИЕ И ПЕРЕСБОРКА С ИСПРАВЛЕНИЕМ АВТОРИЗАЦИИ"
echo "========================================"

echo ""
echo "=== Обновление кода из Git ==="
git pull origin main

echo ""
echo "=== Пересборка приложения ==="
docker-compose build app

echo ""
echo "=== Перезапуск контейнеров ==="
docker-compose up -d
sleep 10

echo ""
echo "=== Проверка статуса ==="
docker-compose ps

echo ""
echo "=== Health check ==="
curl -s http://localhost:3000/api/health | head -1
echo ""

echo ""
echo "=== Логи (последние 10 строк) ==="
docker-compose logs --tail=10 app

echo ""
echo "========================================"
echo "ГОТОВО"
echo "========================================"
ENDSSH

