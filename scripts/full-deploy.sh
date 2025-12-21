#!/bin/bash

# Полный автоматический деплой CRM на Selectel
# Использование: ./scripts/full-deploy.sh

set -e  # Остановка при ошибке

echo "🚀 Начало полного деплоя CRM"
echo "================================"
echo ""

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Проверка, что мы в правильной директории
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ Ошибка: docker-compose.yml не найден${NC}"
    exit 1
fi

echo "1️⃣  Остановка и очистка существующих контейнеров..."
docker compose down -v 2>/dev/null || true
docker rmi ai-crm-app 2>/dev/null || true
docker volume rm ai-crm_postgres_data 2>/dev/null || true
echo -e "${GREEN}✅ Очистка завершена${NC}"
echo ""

echo "2️⃣  Пересборка Docker-образов..."
docker compose build --no-cache
echo -e "${GREEN}✅ Сборка завершена${NC}"
echo ""

echo "3️⃣  Запуск контейнеров..."
docker compose up -d
echo -e "${GREEN}✅ Контейнеры запущены${NC}"
echo ""

echo "4️⃣  Ожидание готовности PostgreSQL (30 секунд)..."
sleep 30

# Проверка статуса PostgreSQL
for i in {1..10}; do
    if docker compose exec -T postgres pg_isready -U crm_user > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL готов${NC}"
        break
    fi
    echo "   Ожидание... ($i/10)"
    sleep 3
done
echo ""

echo "5️⃣  Очистка состояния миграций..."
docker compose exec -T postgres psql -U crm_user -d crm_db -c "DROP TABLE IF EXISTS _prisma_migrations CASCADE;" 2>/dev/null || true
echo -e "${GREEN}✅ Очистка завершена${NC}"
echo ""

echo "6️⃣  Применение миграций базы данных..."
if docker compose exec -T app npx -y prisma@6.19.0 migrate deploy; then
    echo -e "${GREEN}✅ Миграции применены${NC}"
else
    echo -e "${YELLOW}⚠️  Ошибка при применении миграций. Пробуем исправить...${NC}"
    
    # Исправление проблемных миграций
    echo "   Исправление порядка миграций..."
    docker compose exec -u root app sh -c 'if [ -d "/app/prisma/migrations/20250101000000_add_email_templates" ]; then mv /app/prisma/migrations/20250101000000_add_email_templates /app/prisma/migrations/20251215000000_add_email_templates; fi' 2>/dev/null || true
    
    # Повторная попытка
    docker compose exec -T postgres psql -U crm_user -d crm_db -c "DROP TABLE IF EXISTS _prisma_migrations CASCADE;" 2>/dev/null || true
    docker compose exec -T app npx -y prisma@6.19.0 migrate deploy
    echo -e "${GREEN}✅ Миграции применены${NC}"
fi
echo ""

echo "7️⃣  Генерация Prisma Client..."
docker compose exec -T app npx -y prisma@6.19.0 generate
echo -e "${GREEN}✅ Prisma Client сгенерирован${NC}"
echo ""

echo "8️⃣  Проверка работы приложения..."
sleep 5

if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Приложение работает!${NC}"
    echo ""
    echo "🌐 Приложение доступно на: http://79.143.30.96:3000"
else
    echo -e "${YELLOW}⚠️  Приложение еще запускается. Проверьте логи:${NC}"
    echo "   docker compose logs -f app"
fi
echo ""

echo "================================"
echo -e "${GREEN}✅ Деплой завершен!${NC}"
echo ""
echo "📋 Полезные команды:"
echo "   • Логи: docker compose logs -f app"
echo "   • Статус: docker compose ps"
echo "   • Перезапуск: docker compose restart"
echo ""



