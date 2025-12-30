#!/bin/bash
# Скрипт для настройки автоматических бэкапов через cron

set -e

BACKUP_SCRIPT="/opt/flamecrm/scripts/backup-db.sh"
CRON_SCHEDULE="${CRON_SCHEDULE:-0 2 * * *}"  # По умолчанию в 2:00 ночи каждый день

# Проверяем существование скрипта бэкапа
if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo "ОШИБКА: Скрипт бэкапа не найден: $BACKUP_SCRIPT"
    exit 1
fi

# Делаем скрипт исполняемым
chmod +x "$BACKUP_SCRIPT"

# Создаем cron задачу
CRON_JOB="$CRON_SCHEDULE $BACKUP_SCRIPT >> /opt/flamecrm/backups/cron.log 2>&1"

# Проверяем, не добавлена ли уже задача
if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
    echo "Задача бэкапа уже добавлена в crontab"
    crontab -l | grep "$BACKUP_SCRIPT"
else
    # Добавляем задачу в crontab
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "Задача автоматического бэкапа добавлена в crontab:"
    echo "  Расписание: $CRON_SCHEDULE"
    echo "  Скрипт: $BACKUP_SCRIPT"
    echo ""
    echo "Текущие задачи cron:"
    crontab -l
fi

