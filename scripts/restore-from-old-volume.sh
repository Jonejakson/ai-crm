#!/bin/bash
# Скрипт восстановления данных из старого тома ai-crm_postgres_data

set -e

echo "=== Восстановление данных из старого тома ==="

cd /opt/flamecrm

# Остановить текущую базу
echo "1. Остановка текущей базы данных..."
docker-compose stop postgres

# Запустить временный контейнер со старым томом
echo "2. Запуск временного контейнера со старым томом..."
docker run -d --name temp_postgres_restore \
  -e POSTGRES_USER=crm_user \
  -e POSTGRES_PASSWORD=0eb9b983f980d58e7f9798f188f25fbf \
  -e POSTGRES_DB=crm_db \
  -v ai-crm_postgres_data:/var/lib/postgresql/data \
  -p 5433:5432 \
  postgres:15-alpine

echo "3. Ожидание запуска PostgreSQL..."
sleep 20

# Проверить данные
echo "4. Проверка данных в старом томе..."
USER_COUNT=$(docker exec temp_postgres_restore psql -U crm_user -d crm_db -t -c "SELECT COUNT(*) FROM \"User\";" | tr -d ' ')

if [ "$USER_COUNT" -gt 0 ]; then
  echo "✅ Найдено пользователей: $USER_COUNT"
  
  # Создать дамп
  echo "5. Создание дампа из старого тома..."
  docker exec temp_postgres_restore pg_dump -U crm_user crm_db > /tmp/restored_backup_$(date +%Y%m%d_%H%M%S).sql
  
  echo "✅ Дамп создан: /tmp/restored_backup_*.sql"
  
  # Остановить временный контейнер
  echo "6. Остановка временного контейнера..."
  docker stop temp_postgres_restore
  docker rm temp_postgres_restore
  
  # Восстановить в текущую базу
  echo "7. Запуск текущей базы данных..."
  docker-compose up -d postgres
  sleep 15
  
  echo "8. Восстановление данных в текущую базу..."
  LATEST_BACKUP=$(ls -t /tmp/restored_backup_*.sql | head -1)
  cat "$LATEST_BACKUP" | docker-compose exec -T postgres psql -U crm_user -d crm_db
  
  echo "✅ Данные восстановлены!"
  
  # Проверить восстановление
  echo "9. Проверка восстановленных данных..."
  docker-compose exec postgres psql -U crm_user -d crm_db -c "SELECT COUNT(*) as users FROM \"User\";"
  
else
  echo "❌ Пользователей не найдено в старом томе"
  docker stop temp_postgres_restore
  docker rm temp_postgres_restore
fi

echo "=== Готово ==="

