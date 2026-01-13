#!/bin/bash

# Скрипт для исправления ошибки 502 Bad Gateway

echo "🔧 Исправление ошибки 502 Bad Gateway"
echo ""

cd /opt/flamecrm || exit 1

echo "📊 Проверка статуса контейнеров..."
docker-compose ps

echo ""
echo "🚀 Запуск контейнеров..."
docker-compose up -d

echo ""
echo "⏳ Ожидание запуска (20 секунд)..."
sleep 20

echo ""
echo "📊 Статус после запуска:"
docker-compose ps

echo ""
echo "🔍 Проверка доступности приложения:"
curl -s http://127.0.0.1:3000/api/health || echo "Приложение не отвечает"

echo ""
echo "🔄 Перезагрузка Nginx..."
systemctl reload nginx

echo ""
echo "✅ Проверка через Nginx:"
curl -s -o /dev/null -w "HTTP код: %{http_code}\n" https://flamecrm.ru/api/health

echo ""
echo "📋 Логи приложения (последние 10 строк):"
docker-compose logs --tail=10 app

echo ""
echo "✅ Готово!"















