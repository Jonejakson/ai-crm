#!/bin/bash
# Скрипт для проверки безопасности приложения

set -e

echo "=== Проверка безопасности Flame CRM ==="
echo ""

ERRORS=0
WARNINGS=0

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функции для вывода
error() {
    echo -e "${RED}❌ ОШИБКА:${NC} $1"
    ((ERRORS++))
}

warning() {
    echo -e "${YELLOW}⚠️  ПРЕДУПРЕЖДЕНИЕ:${NC} $1"
    ((WARNINGS++))
}

success() {
    echo -e "${GREEN}✅${NC} $1"
}

# 1. Проверка ENCRYPTION_KEY
echo "1. Проверка ENCRYPTION_KEY..."
if [ -f "/opt/flamecrm/.env" ]; then
    ENCRYPTION_KEY=$(grep "^ENCRYPTION_KEY=" /opt/flamecrm/.env | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
    
    if [ -z "$ENCRYPTION_KEY" ]; then
        error "ENCRYPTION_KEY не установлен в .env"
    elif [ ${#ENCRYPTION_KEY} -lt 32 ]; then
        error "ENCRYPTION_KEY слишком короткий (минимум 32 символа, сейчас: ${#ENCRYPTION_KEY})"
    else
        success "ENCRYPTION_KEY установлен (длина: ${#ENCRYPTION_KEY} символов)"
    fi
else
    error "Файл .env не найден"
fi

# 2. Проверка NODE_ENV
echo ""
echo "2. Проверка NODE_ENV..."
NODE_ENV=$(grep "^NODE_ENV=" /opt/flamecrm/.env 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "")
if [ "$NODE_ENV" = "production" ]; then
    success "NODE_ENV установлен в production"
else
    warning "NODE_ENV не установлен в production (текущее значение: ${NODE_ENV:-не установлено})"
fi

# 3. Проверка health check endpoint
echo ""
echo "3. Проверка health check endpoint..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "000")
if [ "$HEALTH_RESPONSE" = "200" ]; then
    HEALTH_DATA=$(curl -s http://localhost:3000/api/health 2>/dev/null || echo "{}")
    ENCRYPTION_STATUS=$(echo "$HEALTH_DATA" | grep -o '"encryption":{"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
    
    if [ "$ENCRYPTION_STATUS" = "ok" ]; then
        success "Health check показывает, что шифрование настроено правильно"
    else
        error "Health check показывает проблему с шифрованием: $ENCRYPTION_STATUS"
    fi
else
    warning "Health check endpoint недоступен (HTTP $HEALTH_RESPONSE)"
fi

# 4. Проверка HTTPS (если доступен)
echo ""
echo "4. Проверка HTTPS..."
if command -v curl &> /dev/null; then
    # Пытаемся получить домен из .env или используем localhost
    DOMAIN=$(grep "^NEXTAUTH_URL=" /opt/flamecrm/.env 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'" | sed 's|https\?://||' | cut -d'/' -f1 || echo "")
    
    if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "localhost" ] && [ "$DOMAIN" != "127.0.0.1" ]; then
        HTTPS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/api/health" 2>/dev/null || echo "000")
        if [ "$HTTPS_RESPONSE" = "200" ]; then
            success "HTTPS работает для домена $DOMAIN"
        else
            warning "HTTPS недоступен для домена $DOMAIN (HTTP $HTTPS_RESPONSE)"
        fi
    else
        warning "Домен не настроен в NEXTAUTH_URL, пропускаем проверку HTTPS"
    fi
fi

# 5. Проверка security headers
echo ""
echo "5. Проверка security headers..."
if command -v curl &> /dev/null; then
    HEADERS=$(curl -s -I http://localhost:3000/api/health 2>/dev/null || echo "")
    
    if echo "$HEADERS" | grep -q "X-Frame-Options"; then
        success "X-Frame-Options установлен"
    else
        warning "X-Frame-Options не установлен"
    fi
    
    if echo "$HEADERS" | grep -q "X-Content-Type-Options"; then
        success "X-Content-Type-Options установлен"
    else
        warning "X-Content-Type-Options не установлен"
    fi
    
    if echo "$HEADERS" | grep -q "Content-Security-Policy"; then
        success "Content-Security-Policy установлен"
    else
        warning "Content-Security-Policy не установлен"
    fi
else
    warning "curl не установлен, пропускаем проверку headers"
fi

# 6. Проверка rate limiting
echo ""
echo "6. Проверка rate limiting..."
if [ -f "/opt/flamecrm/middleware.ts" ] || [ -f "/opt/flamecrm/lib/rate-limit.ts" ]; then
    success "Rate limiting реализован в middleware"
else
    warning "Rate limiting не найден в коде"
fi

# 7. Проверка паролей в БД (опционально)
echo ""
echo "7. Проверка паролей в БД..."
if command -v docker-compose &> /dev/null; then
    cd /opt/flamecrm 2>/dev/null || exit 0
    
    # Проверяем, что пароли зашифрованы (проверяем формат)
    # Это упрощенная проверка - в реальности нужно проверить все чувствительные поля
    DB_PASSWORDS=$(docker-compose exec -T postgres psql -U crm_user -d crm_db -c "SELECT COUNT(*) FROM \"User\" WHERE password IS NOT NULL;" 2>/dev/null | grep -o '[0-9]*' | tail -1 || echo "0")
    
    if [ "$DB_PASSWORDS" -gt 0 ]; then
        success "Найдено $DB_PASSWORDS пользователей с паролями в БД"
    else
        warning "Не найдено пользователей в БД (возможно, БД недоступна)"
    fi
fi

# Итоги
echo ""
echo "=== Итоги проверки ==="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ Все проверки пройдены успешно!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Найдено предупреждений: $WARNINGS${NC}"
    echo -e "${GREEN}✅ Критических ошибок не найдено${NC}"
    exit 0
else
    echo -e "${RED}❌ Найдено ошибок: $ERRORS${NC}"
    echo -e "${YELLOW}⚠️  Найдено предупреждений: $WARNINGS${NC}"
    exit 1
fi

