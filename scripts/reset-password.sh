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

# Генерируем хеш пароля через Prisma/Node.js скрипт в контейнере
HASHED_PASSWORD=$(docker exec -i crm_app node -e "
const bcrypt = require('bcryptjs');
(async () => {
  try {
    const hash = await bcrypt.hash('$NEW_PASSWORD', 10);
    console.log(hash);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
")

if [ -z "$HASHED_PASSWORD" ] || [[ "$HASHED_PASSWORD" == *"Error"* ]]; then
    echo "Ошибка: не удалось сгенерировать хеш пароля"
    echo "Попытка через альтернативный метод..."
    
    # Альтернативный способ - через временный скрипт
    cat > /tmp/hash-password.js << 'JS'
const bcrypt = require('bcryptjs');
const password = process.argv[2];
bcrypt.hash(password, 10).then(hash => {
  console.log(hash);
  process.exit(0);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
JS
    
    HASHED_PASSWORD=$(docker exec -i crm_app node /tmp/hash-password.js "$NEW_PASSWORD" 2>/dev/null)
    
    if [ -z "$HASHED_PASSWORD" ] || [[ "$HASHED_PASSWORD" == *"Error"* ]]; then
        echo "❌ Критическая ошибка: не удалось сгенерировать хеш"
        echo "Проверьте, что bcryptjs установлен в контейнере"
        exit 1
    fi
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

