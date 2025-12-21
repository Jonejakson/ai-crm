#!/bin/bash

# Полное исправление проблемы 502 для приложения

set -e

echo "🔧 Исправление проблемы 502 Bad Gateway"
echo ""

cd /opt/flamecrm || exit 1

echo "1️⃣ Остановка и удаление старого контейнера..."
docker-compose stop app || true
docker-compose rm -f app || true

echo ""
echo "2️⃣ Пересборка образа приложения..."
docker-compose build --no-cache app

echo ""
echo "3️⃣ Запуск контейнера..."
docker-compose up -d app

echo ""
echo "4️⃣ Ожидание запуска (30 секунд)..."
sleep 30

echo ""
echo "5️⃣ Проверка статуса:"
docker-compose ps

echo ""
echo "6️⃣ Проверка доступности приложения:"
if curl -s http://127.0.0.1:3000/api/health > /dev/null; then
    echo "✅ Приложение работает!"
    curl -s http://127.0.0.1:3000/api/health | head -1
else
    echo "❌ Приложение не отвечает"
    echo ""
    echo "📋 Последние логи:"
    docker-compose logs --tail=30 app
fi

echo ""
echo "7️⃣ Перезагрузка Nginx..."
systemctl reload nginx

echo ""
echo "8️⃣ Проверка через Nginx:"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://flamecrm.ru/api/health)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Сайт работает! HTTP код: $HTTP_CODE"
else
    echo "⚠️  HTTP код: $HTTP_CODE"
    echo "Проверьте логи Nginx: tail -20 /var/log/nginx/error.log"
fi

echo ""
echo "✅ Готово!"


