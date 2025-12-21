#!/bin/bash

# Скрипт для обновления деплоя на сервере Selectel
# Использование: ./scripts/update-deploy.sh

set -e  # Остановка при ошибке

echo "🔄 Обновление деплоя на сервере Selectel"
echo ""

# Проверка, что мы в правильной директории
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Ошибка: docker-compose.yml не найден. Убедитесь, что вы в директории my-app"
    exit 1
fi

# Обновление кода из Git
echo "📥 Получение последних изменений из Git..."
git pull origin main

echo ""
echo "🔨 Пересборка и перезапуск контейнеров..."
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Ожидание готовности PostgreSQL
echo ""
echo "⏳ Ожидание готовности PostgreSQL..."
sleep 15

# Применение миграций
echo ""
echo "📦 Применение миграций базы данных..."
docker-compose exec -T app npx prisma migrate deploy || {
    echo "⚠️  Ошибка при применении миграций. Попробуйте вручную:"
    echo "   docker-compose exec app npx prisma migrate deploy"
}

echo ""
echo "🔧 Генерация Prisma Client..."
docker-compose exec -T app npx prisma generate || {
    echo "⚠️  Ошибка при генерации Prisma Client. Попробуйте вручную:"
    echo "   docker-compose exec app npx prisma generate"
}

echo ""
echo "✅ Обновление завершено!"
echo ""
echo "📋 Проверка статуса:"
docker-compose ps

echo ""
echo "📋 Проверка логов:"
echo "   docker-compose logs -f app"



