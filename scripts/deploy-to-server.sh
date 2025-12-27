#!/bin/bash

# Скрипт для деплоя на сервер Selectel
# Использование: ./scripts/deploy-to-server.sh

SERVER="root@79.143.30.96"
SERVER_PATH="/opt/flamecrm"

echo "=== Проверка локальных изменений ==="
git status

echo ""
echo "=== Последние коммиты локально ==="
git log --oneline -5

echo ""
echo "=== Проверка синхронизации с origin ==="
git fetch origin
LOCAL_COMMITS=$(git log --oneline origin/main..HEAD)

if [ -n "$LOCAL_COMMITS" ]; then
    echo "Есть локальные коммиты, которых нет на origin:"
    echo "$LOCAL_COMMITS"
    echo ""
    echo "Отправляю на origin..."
    git push origin main
else
    echo "Локальная ветка синхронизирована с origin/main"
fi

echo ""
echo "=== Деплой на сервер ==="
echo "Подключение к серверу и обновление кода..."

ssh $SERVER << EOF
cd $SERVER_PATH
echo '=== Текущий статус на сервере ==='
git status
echo ''
echo '=== Последние коммиты на сервере ==='
git log --oneline -5
echo ''
echo '=== Получение изменений с origin ==='
git fetch origin
echo ''
echo '=== Обновление кода ==='
git pull origin main
echo ''
echo '=== Перезапуск приложения ==='
docker-compose restart app
echo ''
echo '=== Проверка статуса ==='
docker-compose ps
EOF

echo ""
echo "=== Готово ==="

