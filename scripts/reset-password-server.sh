#!/bin/bash
# Скрипт для сброса пароля на сервере

EMAIL="$1"
NEW_PASSWORD="$2"

if [ -z "$EMAIL" ] || [ -z "$NEW_PASSWORD" ]; then
  echo "Использование: $0 <email> <новый_пароль>"
  exit 1
fi

# Генерируем хеш пароля через Node.js в контейнере
HASH=$(docker exec crm_app node -e "const bcrypt=require('bcryptjs');console.log(bcrypt.hashSync('$NEW_PASSWORD',10));")

if [ -z "$HASH" ]; then
  echo "Ошибка: не удалось сгенерировать хеш"
  exit 1
fi

# Обновляем пароль в БД
docker exec crm_postgres psql -U crm_user -d crm_db -c "UPDATE \"User\" SET password = '$HASH' WHERE email = '$EMAIL';"

echo "Пароль обновлен для $EMAIL"


