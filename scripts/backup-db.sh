#!/bin/bash
# Скрипт для резервного копирования базы данных PostgreSQL

set -e

# Настройки
BACKUP_DIR="${BACKUP_DIR:-/opt/flamecrm/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/flamecrm/docker-compose.yml}"
DB_USER="${DB_USER:-crm_user}"
DB_NAME="${DB_NAME:-crm_db}"

# Создаем директорию для бэкапов если не существует
mkdir -p "$BACKUP_DIR"

# Генерируем имя файла с датой и временем
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/crm_db_backup_$DATE.sql"
BACKUP_FILE_GZ="$BACKUP_FILE.gz"

# Логирование
LOG_FILE="$BACKUP_DIR/backup.log"
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== Начало резервного копирования ==="

# Проверяем, что docker-compose доступен
if ! command -v docker-compose &> /dev/null; then
    log "ОШИБКА: docker-compose не найден!"
    exit 1
fi

# Проверяем, что контейнер PostgreSQL запущен
if ! docker-compose -f "$COMPOSE_FILE" ps postgres | grep -q "Up"; then
    log "ОШИБКА: Контейнер PostgreSQL не запущен!"
    exit 1
fi

# Создаем бэкап
log "Создание бэкапа базы данных..."
if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE" 2>>"$LOG_FILE"; then
    # Сжимаем бэкап
    log "Сжатие бэкапа..."
    gzip -f "$BACKUP_FILE"
    
    # Получаем размер файла
    BACKUP_SIZE=$(du -h "$BACKUP_FILE_GZ" | cut -f1)
    log "Бэкап создан успешно: $BACKUP_FILE_GZ (размер: $BACKUP_SIZE)"
    
    # Загружаем в S3, если настроено
    if [ -n "$S3_ACCESS_KEY_ID" ] && [ -n "$S3_SECRET_ACCESS_KEY" ] && [ -n "$S3_BUCKET_NAME" ]; then
        log "Загрузка бэкапа в S3..."
        S3_KEY="backups/db/crm_db_backup_$DATE.sql.gz"
        
        # Используем AWS CLI если установлен, иначе используем наш скрипт
        if command -v aws &> /dev/null; then
            aws s3 cp "$BACKUP_FILE_GZ" "s3://$S3_BUCKET_NAME/$S3_KEY" \
                --endpoint-url="${S3_ENDPOINT:-https://s3.selcdn.ru}" \
                --region="${S3_REGION:-ru-7}" \
                >> "$LOG_FILE" 2>&1 && \
            log "Бэкап загружен в S3: s3://$S3_BUCKET_NAME/$S3_KEY" || \
            log "ОШИБКА: Не удалось загрузить бэкап в S3"
        else
            log "ПРЕДУПРЕЖДЕНИЕ: AWS CLI не установлен, пропускаем загрузку в S3"
        fi
    fi
    
    # Удаляем старые бэкапы (старше RETENTION_DAYS дней)
    log "Удаление старых бэкапов (старше $RETENTION_DAYS дней)..."
    find "$BACKUP_DIR" -name "crm_db_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
    DELETED_COUNT=$(find "$BACKUP_DIR" -name "crm_db_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS | wc -l)
    if [ "$DELETED_COUNT" -gt 0 ]; then
        log "Удалено старых бэкапов: $DELETED_COUNT"
    fi
    
    log "=== Резервное копирование завершено успешно ==="
    exit 0
else
    log "ОШИБКА: Не удалось создать бэкап!"
    # Удаляем пустой файл если он был создан
    [ -f "$BACKUP_FILE" ] && rm -f "$BACKUP_FILE"
    exit 1
fi

