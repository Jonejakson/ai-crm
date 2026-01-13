#!/bin/bash

# Скрипт для проверки состояния деплоя на Selectel
# Использование: ./scripts/check-deployment.sh

echo "🔍 Проверка состояния деплоя CRM на Selectel"
echo "=============================================="
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка 1: Docker установлен
echo "1️⃣  Проверка Docker..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo -e "${GREEN}✅ Docker установлен: ${DOCKER_VERSION}${NC}"
else
    echo -e "${RED}❌ Docker не установлен${NC}"
    exit 1
fi

if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    echo -e "${GREEN}✅ Docker Compose установлен: ${COMPOSE_VERSION}${NC}"
else
    echo -e "${RED}❌ Docker Compose не установлен${NC}"
    exit 1
fi
echo ""

# Проверка 2: Репозиторий клонирован
echo "2️⃣  Проверка репозитория..."
if [ -d "/opt/ai-crm/my-app" ]; then
    echo -e "${GREEN}✅ Репозиторий найден в /opt/ai-crm/my-app${NC}"
    cd /opt/ai-crm/my-app
elif [ -f "docker-compose.yml" ]; then
    echo -e "${GREEN}✅ Репозиторий найден в текущей директории${NC}"
else
    echo -e "${RED}❌ Репозиторий не найден${NC}"
    echo "   Выполните: cd /opt && git clone https://github.com/Jonejakson/ai-crm.git"
    exit 1
fi
echo ""

# Проверка 3: Docker файлы
echo "3️⃣  Проверка Docker файлов..."
if [ -f "Dockerfile" ]; then
    echo -e "${GREEN}✅ Dockerfile найден${NC}"
else
    echo -e "${RED}❌ Dockerfile не найден${NC}"
fi

if [ -f "docker-compose.yml" ]; then
    echo -e "${GREEN}✅ docker-compose.yml найден${NC}"
else
    echo -e "${RED}❌ docker-compose.yml не найден${NC}"
fi

if [ -f ".dockerignore" ]; then
    echo -e "${GREEN}✅ .dockerignore найден${NC}"
else
    echo -e "${YELLOW}⚠️  .dockerignore не найден (не критично)${NC}"
fi
echo ""

# Проверка 4: Файл .env
echo "4️⃣  Проверка переменных окружения..."
if [ -f ".env" ]; then
    echo -e "${GREEN}✅ Файл .env найден${NC}"
    
    # Проверка обязательных переменных
    source .env
    
    REQUIRED_VARS=("POSTGRES_PASSWORD" "NEXTAUTH_URL" "NEXTAUTH_SECRET")
    MISSING_VARS=()
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            MISSING_VARS+=("$var")
        fi
    done
    
    if [ ${#MISSING_VARS[@]} -eq 0 ]; then
        echo -e "${GREEN}✅ Все обязательные переменные установлены${NC}"
    else
        echo -e "${YELLOW}⚠️  Отсутствуют переменные: ${MISSING_VARS[*]}${NC}"
    fi
    
    # Проверка ENCRYPTION_KEY (критично для production)
    if [ -z "$ENCRYPTION_KEY" ]; then
        echo -e "${YELLOW}⚠️  ENCRYPTION_KEY не установлен (критично для production!)${NC}"
        echo "   Сгенерируйте: openssl rand -hex 32"
    else
        if [ ${#ENCRYPTION_KEY} -lt 64 ]; then
            echo -e "${YELLOW}⚠️  ENCRYPTION_KEY слишком короткий (минимум 64 символа)${NC}"
        else
            echo -e "${GREEN}✅ ENCRYPTION_KEY установлен${NC}"
        fi
    fi
else
    echo -e "${RED}❌ Файл .env не найден${NC}"
    echo "   Создайте файл .env с необходимыми переменными"
fi
echo ""

# Проверка 5: Статус контейнеров
echo "5️⃣  Проверка статуса контейнеров..."
if docker-compose ps &> /dev/null; then
    CONTAINERS=$(docker-compose ps -q)
    if [ -z "$CONTAINERS" ]; then
        echo -e "${YELLOW}⚠️  Контейнеры не запущены${NC}"
        echo "   Запустите: docker-compose up -d"
    else
        echo -e "${GREEN}✅ Контейнеры запущены:${NC}"
        docker-compose ps
        
        # Проверка здоровья контейнеров
        APP_STATUS=$(docker-compose ps app | grep -c "Up" || echo "0")
        POSTGRES_STATUS=$(docker-compose ps postgres | grep -c "Up" || echo "0")
        
        if [ "$APP_STATUS" -eq 1 ]; then
            echo -e "${GREEN}✅ Контейнер app работает${NC}"
        else
            echo -e "${RED}❌ Контейнер app не работает${NC}"
        fi
        
        if [ "$POSTGRES_STATUS" -eq 1 ]; then
            echo -e "${GREEN}✅ Контейнер postgres работает${NC}"
        else
            echo -e "${RED}❌ Контейнер postgres не работает${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Не удалось проверить статус контейнеров${NC}"
fi
echo ""

# Проверка 6: Доступность приложения
echo "6️⃣  Проверка доступности приложения..."
if docker-compose ps app | grep -q "Up"; then
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Приложение доступно на http://localhost:3000${NC}"
    else
        echo -e "${YELLOW}⚠️  Приложение запущено, но не отвечает на /api/health${NC}"
        echo "   Проверьте логи: docker-compose logs app"
    fi
else
    echo -e "${YELLOW}⚠️  Приложение не запущено${NC}"
fi
echo ""

# Проверка 7: База данных
echo "7️⃣  Проверка базы данных..."
if docker-compose ps postgres | grep -q "Up"; then
    if docker-compose exec -T postgres pg_isready -U crm_user > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL доступен${NC}"
        
        # Проверка миграций
        if docker-compose exec -T app npx prisma migrate status > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Prisma подключен к базе данных${NC}"
        else
            echo -e "${YELLOW}⚠️  Проблемы с подключением Prisma${NC}"
            echo "   Примените миграции: docker-compose exec app npx prisma migrate deploy"
        fi
    else
        echo -e "${RED}❌ PostgreSQL не отвечает${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  PostgreSQL не запущен${NC}"
fi
echo ""

# Проверка 8: Nginx
echo "8️⃣  Проверка Nginx..."
if command -v nginx &> /dev/null; then
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}✅ Nginx запущен${NC}"
        
        if [ -f "/etc/nginx/sites-enabled/crm" ] || [ -f "/etc/nginx/sites-available/crm" ]; then
            echo -e "${GREEN}✅ Конфигурация Nginx найдена${NC}"
        else
            echo -e "${YELLOW}⚠️  Конфигурация Nginx не найдена${NC}"
            echo "   Создайте: /etc/nginx/sites-available/crm"
        fi
    else
        echo -e "${YELLOW}⚠️  Nginx установлен, но не запущен${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Nginx не установлен${NC}"
    echo "   Установите: sudo apt install -y nginx"
fi
echo ""

# Итоговая сводка
echo "=============================================="
echo "📋 Итоговая сводка:"
echo ""

# Подсчет проблем
ISSUES=0

if ! command -v docker &> /dev/null; then ((ISSUES++)); fi
if [ ! -f ".env" ]; then ((ISSUES++)); fi
if ! docker-compose ps app | grep -q "Up"; then ((ISSUES++)); fi

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ Все основные проверки пройдены!${NC}"
    echo ""
    echo "📝 Следующие шаги:"
    echo "   1. Настройте Nginx (если еще не настроен)"
    echo "   2. Настройте SSL сертификат: sudo certbot --nginx -d your-domain.com"
    echo "   3. Настройте домен в панели Selectel"
else
    echo -e "${YELLOW}⚠️  Обнаружены проблемы. Исправьте их перед продолжением.${NC}"
fi

echo ""
echo "📚 Полезные команды:"
echo "   • Логи приложения: docker-compose logs -f app"
echo "   • Статус контейнеров: docker-compose ps"
echo "   • Перезапуск: docker-compose restart"
echo "   • Остановка: docker-compose down"
echo "   • Запуск: docker-compose up -d"
echo ""

















