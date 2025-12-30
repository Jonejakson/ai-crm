#!/bin/bash
# Скрипт для восстановления базы данных из бэкапа

set -e

# Настройки
BACKUP_DIR="${BACKUP_DIR:-/opt/flamecrm/backups}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/flamecrm/docker-compose.yml}"
DB_USER="${DB_USER:-crm_user}"
DB_NAME="${DB_NAME:-crm_db}"

# Проверка аргументов
if [ $# -eq 0 ]; then
    echo "Использование: $0 <путь_к_бэкапу>"
    echo ""
    echo "Примеры:"
    echo "  $0 $BACKUP_DIR/crm_db_backup_20250127_120000.sql.gz"
    echo "  $0 $BACKUP_DIR/crm_db_backup_20250127_120000.sql"
    echo ""
    echo "Доступные бэкапы:"
    ls -lh "$BACKUP_DIR"/crm_db_backup_*.sql* 2>/dev/null | tail -10 || echo "Бэкапы не найдены"
    exit 1
fi

BACKUP_FILE="$1"

# Проверяем существование файла
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ОШИБКА: Файл бэкапа не найден: $BACKUP_FILE"
    exit 1
fi

# Проверяем, что docker-compose доступен
if ! command -v docker-compose &> /dev/null; then
    echo "ОШИБКА: docker-compose не найден!"
    exit 1
fi

# Проверяем, что контейнер PostgreSQL запущен
if ! docker-compose -f "$COMPOSE_FILE" ps postgres | grep -q "Up"; then
    echo "ОШИБКА: Контейнер PostgreSQL не запущен!"
    exit 1
fi

echo "ВНИМАНИЕ: Это действие перезапишет текущую базу данных!"
echo "Бэкап: $BACKUP_FILE"
echo "База данных: $DB_NAME"
read -p "Вы уверены? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Восстановление отменено."
    exit 0
fi

echo "Начало восстановления..."

# Распаковываем если это .gz файл
TEMP_FILE=""
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "Распаковка бэкапа..."
    TEMP_FILE="/tmp/restore_$(basename "$BACKUP_FILE" .gz)"
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
    RESTORE_FILE="$TEMP_FILE"
else
    RESTORE_FILE="$BACKUP_FILE"
fi

# Восстанавливаем базу данных
echo "Восстановление базы данных..."
if docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" < "$RESTORE_FILE" 2>&1; then
    echo "База данных успешно восстановлена!"
    
    # Удаляем временный файл если был создан
    [ -n "$TEMP_FILE" ] && rm -f "$TEMP_FILE"
    
    exit 0
else
    echo "ОШИБКА: Не удалось восстановить базу данных!"
    [ -n "$TEMP_FILE" ] && rm -f "$TEMP_FILE"
    exit 1
fi

