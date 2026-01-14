#!/bin/bash
# Скрипт для создания тестового пользователя

set -e

# Загружаем переменные окружения
if [ -f "/opt/flamecrm/.env" ]; then
    source "/opt/flamecrm/.env"
else
    echo "ОШИБКА: Файл .env не найден в /opt/flamecrm/"
    exit 1
fi

# Параметры тестового пользователя
TEST_EMAIL="test@flamecrm.ru"
TEST_PASSWORD="Test123456!"
TEST_NAME="Тестовый пользователь"
TEST_ROLE="admin"

echo "=== Создание тестового пользователя ==="
echo "Email: $TEST_EMAIL"
echo "Пароль: $TEST_PASSWORD"
echo "Роль: $TEST_ROLE"
echo ""

# Генерируем хеш пароля через Node.js
cd /opt/flamecrm

# Проверяем, существует ли пользователь
EXISTING_USER=$(docker-compose exec -T postgres psql -U crm_user -d crm_db -t -c "SELECT id FROM \"User\" WHERE email = '$TEST_EMAIL';" 2>/dev/null | xargs || echo "")

if [ -n "$EXISTING_USER" ] && [ "$EXISTING_USER" != "" ]; then
    echo "⚠️  Пользователь с email $TEST_EMAIL уже существует (ID: $EXISTING_USER)"
    echo "Хотите обновить пароль? (y/n)"
    read -r response
    if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
        # Генерируем хеш пароля
        PASSWORD_HASH=$(docker-compose exec -T app node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('$TEST_PASSWORD', 10));" 2>/dev/null | tr -d '\r\n' || echo "")
        
        if [ -z "$PASSWORD_HASH" ]; then
            echo "ОШИБКА: Не удалось сгенерировать хеш пароля"
            exit 1
        fi
        
        # Обновляем пароль
        docker-compose exec -T postgres psql -U crm_user -d crm_db -c "
            UPDATE \"User\" 
            SET password = '$PASSWORD_HASH',
                name = '$TEST_NAME',
                role = '$TEST_ROLE',
                \"updatedAt\" = NOW()
            WHERE email = '$TEST_EMAIL';
        " > /dev/null 2>&1
        
        echo "✅ Пароль обновлен для пользователя $TEST_EMAIL"
    else
        echo "Отменено"
        exit 0
    fi
else
    # Получаем ID компании (берем первую компанию)
    COMPANY_ID=$(docker-compose exec -T postgres psql -U crm_user -d crm_db -t -c "SELECT id FROM \"Company\" LIMIT 1;" 2>/dev/null | xargs || echo "")
    
    if [ -z "$COMPANY_ID" ] || [ "$COMPANY_ID" = "" ]; then
        echo "ОШИБКА: Не найдена компания в БД"
        exit 1
    fi
    
    echo "Найдена компания с ID: $COMPANY_ID"
    
    # Генерируем хеш пароля
    echo "Генерация хеша пароля..."
    PASSWORD_HASH=$(docker-compose exec -T app node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('$TEST_PASSWORD', 10));" 2>/dev/null | tr -d '\r\n' || echo "")
    
    if [ -z "$PASSWORD_HASH" ]; then
        echo "ОШИБКА: Не удалось сгенерировать хеш пароля"
        exit 1
    fi
    
    # Создаем пользователя
    echo "Создание пользователя..."
    docker-compose exec -T postgres psql -U crm_user -d crm_db -c "
        INSERT INTO \"User\" (email, name, password, role, \"companyId\", \"createdAt\", \"updatedAt\")
        VALUES (
            '$TEST_EMAIL',
            '$TEST_NAME',
            '$PASSWORD_HASH',
            '$TEST_ROLE',
            $COMPANY_ID,
            NOW(),
            NOW()
        )
        ON CONFLICT (email) DO UPDATE
        SET password = EXCLUDED.password,
            name = EXCLUDED.name,
            role = EXCLUDED.role,
            \"updatedAt\" = NOW();
    " > /dev/null 2>&1
    
    echo "✅ Тестовый пользователь создан успешно!"
fi

echo ""
echo "=== Данные для входа ==="
echo "Email: $TEST_EMAIL"
echo "Пароль: $TEST_PASSWORD"
echo "Роль: $TEST_ROLE"
echo ""
echo "Ссылка для входа: https://flamecrm.ru/login"
echo ""


