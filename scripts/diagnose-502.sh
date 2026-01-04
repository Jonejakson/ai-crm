#!/bin/bash

# Диагностика и исправление ошибки 502

echo "🔍 Диагностика проблемы 502 Bad Gateway"
echo ""

cd /opt/flamecrm || exit 1

echo "1️⃣ Проверка статуса контейнеров:"
docker-compose ps -a

echo ""
echo "2️⃣ Последние логи приложения:"
docker-compose logs --tail=30 app

echo ""
echo "3️⃣ Проверка наличия server.js в контейнере:"
docker-compose exec -T app ls -la /app/server.js 2>&1 || echo "❌ server.js не найден!"

echo ""
echo "4️⃣ Проверка структуры /app в контейнере:"
docker-compose exec -T app ls -la /app/ 2>&1 | head -20

echo ""
echo "5️⃣ Попытка запуска контейнера:"
docker-compose stop app
docker-compose rm -f app
docker-compose up -d app

echo ""
echo "⏳ Ожидание 20 секунд..."
sleep 20

echo ""
echo "6️⃣ Статус после запуска:"
docker-compose ps

echo ""
echo "7️⃣ Проверка доступности:"
curl -s http://127.0.0.1:3000/api/health || echo "❌ Приложение не отвечает"

echo ""
echo "8️⃣ Логи после перезапуска:"
docker-compose logs --tail=20 app

echo ""
echo "✅ Диагностика завершена"









