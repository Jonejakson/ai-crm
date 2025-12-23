# Восстановление данных из старого тома

## Обнаружен старый том с данными!

Найден том `ai-crm_postgres_data` от 14 декабря, который может содержать старые данные.

## Восстановление данных

### Вариант 1: Использовать старый том напрямую (быстро)

```bash
cd /opt/flamecrm

# Остановить текущую базу
docker-compose stop postgres

# Временно изменить docker-compose.yml
# Заменить:
#   volumes:
#     - postgres_data:/var/lib/postgresql/data
# На:
#   volumes:
#     - ai-crm_postgres_data:/var/lib/postgresql/data

# Или создать временный docker-compose для восстановления
cat > docker-compose.restore.yml << 'EOF'
version: '3.8'
services:
  postgres_restore:
    image: postgres:15-alpine
    container_name: crm_postgres_restore
    environment:
      POSTGRES_USER: crm_user
      POSTGRES_PASSWORD: 0eb9b983f980d58e7f9798f188f25fbf
      POSTGRES_DB: crm_db
    volumes:
      - ai-crm_postgres_data:/var/lib/postgresql/data
    ports:
      - "5433:5432"
EOF

# Запустить восстановление
docker-compose -f docker-compose.restore.yml up -d postgres_restore

# Подождать запуска
sleep 10

# Проверить данные
docker-compose -f docker-compose.restore.yml exec postgres_restore psql -U crm_user -d crm_db -c "SELECT COUNT(*) FROM \"User\";"

# Если данные есть, сделать дамп
docker-compose -f docker-compose.restore.yml exec postgres_restore pg_dump -U crm_user crm_db > /tmp/restored_backup.sql

# Остановить временный контейнер
docker-compose -f docker-compose.restore.yml down

# Восстановить в основную базу
docker-compose up -d postgres
sleep 10
cat /tmp/restored_backup.sql | docker-compose exec -T postgres psql -U crm_user -d crm_db
```

### Вариант 2: Копировать данные из старого тома

```bash
cd /opt/flamecrm

# Остановить базу
docker-compose stop postgres

# Скопировать данные
docker run --rm \
  -v ai-crm_postgres_data:/source:ro \
  -v flamecrm_postgres_data:/target \
  alpine sh -c "
    echo 'Копирование данных...'
    cp -r /source/* /target/ 2>&1 | head -20
    echo 'Копирование завершено'
    ls -la /target/base/ | head -5
  "

# Запустить базу
docker-compose up -d postgres

# Подождать
sleep 15

# Проверить данные
docker-compose exec postgres psql -U crm_user -d crm_db -c "SELECT COUNT(*) FROM \"User\";"
```

### Вариант 3: Создать дамп из старого тома и восстановить

```bash
cd /opt/flamecrm

# Запустить временный контейнер со старым томом
docker run -d --name temp_postgres \
  -e POSTGRES_USER=crm_user \
  -e POSTGRES_PASSWORD=0eb9b983f980d58e7f9798f188f25fbf \
  -e POSTGRES_DB=crm_db \
  -v ai-crm_postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine

# Подождать запуска
sleep 15

# Создать дамп
docker exec temp_postgres pg_dump -U crm_user crm_db > /tmp/old_data_backup.sql

# Остановить временный контейнер
docker stop temp_postgres
docker rm temp_postgres

# Проверить размер дампа (должен быть больше 0)
ls -lh /tmp/old_data_backup.sql

# Восстановить в текущую базу
docker-compose up -d postgres
sleep 15
cat /tmp/old_data_backup.sql | docker-compose exec -T postgres psql -U crm_user -d crm_db
```

## Проверка после восстановления

```bash
# Проверить пользователей
docker-compose exec postgres psql -U crm_user -d crm_db -c "SELECT email, name, role FROM \"User\";"

# Проверить компании
docker-compose exec postgres psql -U crm_user -d crm_db -c "SELECT id, name FROM \"Company\";"

# Проверить контакты
docker-compose exec postgres psql -U crm_user -d crm_db -c "SELECT COUNT(*) FROM \"Contact\";"
```

## ⚠️ ВАЖНО

Перед восстановлением сделайте резервную копию текущего (пустого) состояния:

```bash
docker-compose exec postgres pg_dump -U crm_user crm_db > /tmp/empty_backup.sql
```



