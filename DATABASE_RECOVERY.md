# Восстановление базы данных

## ⚠️ ВАЖНО: Данные были удалены

При восстановлении системы был удален том базы данных `flamecrm_postgres_data`. Это привело к потере всех данных.

## Возможные варианты восстановления

### 1. Проверить старый том ai-crm_postgres_data

Если есть старый том с данными:

```bash
cd /opt/flamecrm

# Остановить текущую базу
docker-compose stop postgres

# Создать резервную копию текущего (пустого) тома
docker volume create flamecrm_postgres_data_backup
docker run --rm -v flamecrm_postgres_data:/source -v flamecrm_postgres_data_backup:/backup alpine sh -c "cp -r /source/* /backup/"

# Попробовать использовать старый том
# В docker-compose.yml временно изменить:
# volumes:
#   - ai-crm_postgres_data:/var/lib/postgresql/data

# Или скопировать данные из старого тома
docker run --rm \
  -v ai-crm_postgres_data:/old_data \
  -v flamecrm_postgres_data:/new_data \
  alpine sh -c "cp -r /old_data/* /new_data/ 2>/dev/null || true"
```

### 2. Проверить бэкапы на сервере

```bash
# Поиск SQL дампов
find /opt -name "*.sql" -type f
find /root -name "*backup*" -type f
find /home -name "*.sql" -type f

# Проверить cron задачи с бэкапами
crontab -l
cat /etc/cron.d/* | grep -i backup
```

### 3. Восстановление из бэкапа (если есть)

Если найден SQL дамп:

```bash
cd /opt/flamecrm

# Остановить приложение
docker-compose stop app

# Восстановить из дампа
docker-compose exec -T postgres psql -U crm_user -d crm_db < /path/to/backup.sql

# Или через docker
cat /path/to/backup.sql | docker-compose exec -T postgres psql -U crm_user -d crm_db
```

### 4. Восстановление из внешнего бэкапа

Если есть бэкапы в облаке (S3, Google Cloud, etc.):

```bash
# Скачать бэкап
# aws s3 cp s3://bucket/backup.sql /tmp/backup.sql
# gsutil cp gs://bucket/backup.sql /tmp/backup.sql

# Восстановить
cat /tmp/backup.sql | docker-compose exec -T postgres psql -U crm_user -d crm_db
```

### 5. Если бэкапов нет - создать пользователей заново

Если восстановление невозможно, нужно создать пользователей заново:

1. Через форму регистрации на сайте
2. Через скрипт (см. CREATE_USER.md)
3. Через API регистрации

## Предотвращение в будущем

### Настроить автоматические бэкапы

```bash
# Создать скрипт бэкапа
cat > /opt/flamecrm/scripts/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/flamecrm/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

cd /opt/flamecrm
docker-compose exec -T postgres pg_dump -U crm_user crm_db > $BACKUP_DIR/backup_$DATE.sql

# Удалить старые бэкапы (старше 30 дней)
find $BACKUP_DIR -name "backup_*.sql" -mtime +30 -delete

echo "Backup created: $BACKUP_DIR/backup_$DATE.sql"
EOF

chmod +x /opt/flamecrm/scripts/backup-db.sh

# Добавить в cron (ежедневно в 2:00)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/flamecrm/scripts/backup-db.sh") | crontab -
```

### Настроить бэкапы в S3

```bash
# Установить AWS CLI
apt-get install -y awscli

# Настроить credentials
aws configure

# Обновить скрипт бэкапа для загрузки в S3
# Добавить в backup-db.sh:
# aws s3 cp $BACKUP_DIR/backup_$DATE.sql s3://your-bucket/backups/
```

## Извинения

Приношу извинения за удаление данных. В будущем буду более осторожен с командами, которые могут привести к потере данных.













