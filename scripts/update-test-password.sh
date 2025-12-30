#!/bin/bash
# Обновление пароля тестового пользователя

set -e

cd /opt/flamecrm

echo "Генерация хеша пароля Test123456!..."
PASSWORD_HASH=$(docker-compose exec -T app node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('Test123456!', 10));" 2>/dev/null | tr -d '\r\n' | xargs)

if [ -z "$PASSWORD_HASH" ]; then
    echo "ОШИБКА: Не удалось сгенерировать хеш пароля"
    exit 1
fi

echo "Хеш пароля сгенерирован"
echo "Обновление пароля для test@flamecrm.ru..."

docker-compose exec -T postgres psql -U crm_user -d crm_db << EOF
UPDATE "User" 
SET password = '$PASSWORD_HASH',
    "updatedAt" = NOW()
WHERE email = 'test@flamecrm.ru';
EOF

echo "✅ Пароль обновлен!"
echo ""
echo "=== Данные для входа ==="
echo "Email: test@flamecrm.ru"
echo "Пароль: Test123456!"
echo ""

