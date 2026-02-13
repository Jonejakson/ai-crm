#!/bin/bash
# Скрипт для резервного копирования базы данных PostgreSQL

set -e

# Настройки
BACKUP_DIR="${BACKUP_DIR:-/opt/flamecrm/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/flamecrm/docker-compose.yml}"
DB_USER="${DB_USER:-crm_user}"
DB_NAME="${DB_NAME:-crm_db}"

# Загружаем переменные S3 из .env если они не установлены
if [ -z "$S3_ACCESS_KEY_ID" ] && [ -f "/opt/flamecrm/.env" ]; then
    S3_ACCESS_KEY_ID=$(grep "^S3_ACCESS_KEY_ID=" /opt/flamecrm/.env | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
    S3_SECRET_ACCESS_KEY=$(grep "^S3_SECRET_ACCESS_KEY=" /opt/flamecrm/.env | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
    S3_BUCKET_NAME=$(grep "^S3_BUCKET_NAME=" /opt/flamecrm/.env | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
    S3_ENDPOINT=$(grep "^S3_ENDPOINT=" /opt/flamecrm/.env | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
    S3_REGION=$(grep "^S3_REGION=" /opt/flamecrm/.env | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
    S3_USE_VHOSTED=$(grep "^S3_USE_VHOSTED=" /opt/flamecrm/.env | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
fi

S3_ENDPOINT="${S3_ENDPOINT:-https://s3.selcdn.ru}"
S3_REGION="${S3_REGION:-ru-7}"

# Для vHosted адресации Selectel используем другой endpoint формат
# Если используется vHosted, endpoint должен быть s3.region.storage.selcloud.ru
if [ -n "$S3_USE_VHOSTED" ] && [ "$S3_USE_VHOSTED" = "true" ]; then
    S3_ENDPOINT="https://s3.${S3_REGION}.storage.selcloud.ru"
fi

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

# Используем docker compose (v2) или docker-compose (v1)
if docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    log "ОШИБКА: docker compose или docker-compose не найден!"
    exit 1
fi

# Проверяем, что контейнер PostgreSQL запущен
if ! $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps postgres 2>/dev/null | grep -q "Up"; then
    log "ОШИБКА: Контейнер PostgreSQL не запущен!"
    exit 1
fi

# Создаем бэкап
log "Создание бэкапа базы данных..."
if $DOCKER_COMPOSE -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE" 2>>"$LOG_FILE"; then
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
        
        # Используем Node.js скрипт для загрузки (более надежно для Selectel)
        UPLOAD_SCRIPT="$(dirname "$0")/upload-backup-to-s3.js"
        if [ -f "$UPLOAD_SCRIPT" ] && command -v node &> /dev/null; then
            log "Загрузка бэкапа в S3 через Node.js..."
            if node "$UPLOAD_SCRIPT" "$BACKUP_FILE_GZ" >> "$LOG_FILE" 2>&1; then
                log "Бэкап загружен в S3: s3://$S3_BUCKET_NAME/$S3_KEY"
            else
                log "ОШИБКА: Не удалось загрузить бэкап в S3 (проверьте логи выше)"
            fi
        elif command -v aws &> /dev/null; then
            # Fallback на AWS CLI
            log "Загрузка бэкапа в S3 через AWS CLI..."
            export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
            export AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
            export AWS_DEFAULT_REGION="$S3_REGION"
            
            if aws --endpoint-url="$S3_ENDPOINT" \
               s3 cp "$BACKUP_FILE_GZ" "s3://$S3_BUCKET_NAME/$S3_KEY" \
               >> "$LOG_FILE" 2>&1; then
                log "Бэкап загружен в S3: s3://$S3_BUCKET_NAME/$S3_KEY"
            else
                log "ОШИБКА: Не удалось загрузить бэкап в S3 (проверьте логи выше)"
            fi
        else
            log "ПРЕДУПРЕЖДЕНИЕ: Node.js или AWS CLI не установлены, пропускаем загрузку в S3"
        fi
    else
        log "ПРЕДУПРЕЖДЕНИЕ: Переменные S3 не настроены, пропускаем загрузку в S3"
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

