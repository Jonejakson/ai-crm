#!/bin/bash
# Прямое создание тестового пользователя через SQL с готовым хешем

set -e

cd /opt/flamecrm

# Генерируем хеш пароля через Node.js в контейнере
echo "Генерация хеша пароля..."
PASSWORD_HASH=$(docker-compose exec -T app node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('Test123456!', 10));" 2>/dev/null | tr -d '\r\n' | xargs)

if [ -z "$PASSWORD_HASH" ]; then
    echo "ОШИБКА: Не удалось сгенерировать хеш пароля"
    exit 1
fi

echo "Хеш пароля сгенерирован"

# Получаем ID компании
COMPANY_ID=$(docker-compose exec -T postgres psql -U crm_user -d crm_db -t -A -c "SELECT id FROM \"Company\" LIMIT 1;" 2>/dev/null | xargs)

if [ -z "$COMPANY_ID" ]; then
    echo "ОШИБКА: Не найдена компания в БД"
    exit 1
fi

echo "Найдена компания с ID: $COMPANY_ID"

# Создаем или обновляем пользователя
docker-compose exec -T postgres psql -U crm_user -d crm_db << EOF
INSERT INTO "User" (email, name, password, role, "companyId", "createdAt", "updatedAt")
VALUES (
  'test@flamecrm.ru',
  'Тестовый пользователь',
  '$PASSWORD_HASH',
  'admin',
  $COMPANY_ID,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE
SET 
  password = EXCLUDED.password,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  "updatedAt" = NOW();
EOF

echo ""
echo "✅ Тестовый пользователь создан/обновлен!"
echo ""
echo "=== Данные для входа ==="
echo "Email: test@flamecrm.ru"
echo "Пароль: Test123456!"
echo "Роль: admin"
echo ""
echo "Ссылка для входа: https://flamecrm.ru/login"
echo ""


