#!/bin/bash
# Скрипт для сброса пароля пользователя

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Использование: $0 <email> <новый_пароль>"
    echo "Пример: $0 sale1@barier-yug.ru password123"
    exit 1
fi

EMAIL=$1
NEW_PASSWORD=$2

cd /opt/flamecrm

echo "Сброс пароля для пользователя: $EMAIL"
echo ""

# Генерируем хеш пароля через Node.js
HASHED_PASSWORD=$(docker exec -i crm_app node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash('$NEW_PASSWORD', 10).then(hash => {
  console.log(hash);
});
")

if [ -z "$HASHED_PASSWORD" ]; then
    echo "Ошибка: не удалось сгенерировать хеш пароля"
    exit 1
fi

echo "Хеш пароля сгенерирован"
echo ""

# Обновляем пароль в базе данных
docker-compose exec -T postgres psql -U crm_user -d crm_db << SQL
UPDATE "User" 
SET password = '$HASHED_PASSWORD'
WHERE email = '$EMAIL';

SELECT id, email, name, role, "companyId" 
FROM "User" 
WHERE email = '$EMAIL';
SQL

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Пароль успешно обновлен для пользователя: $EMAIL"
    echo "Новый пароль: $NEW_PASSWORD"
else
    echo ""
    echo "❌ Ошибка при обновлении пароля"
    exit 1
fi

