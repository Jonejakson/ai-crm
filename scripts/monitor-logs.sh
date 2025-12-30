#!/bin/bash
# Скрипт для мониторинга логов и отправки алертов

set -e

LOG_DIR="${LOG_DIR:-/opt/flamecrm/logs}"
APP_LOG="${APP_LOG:-/opt/flamecrm/logs/app.log}"
ERROR_LOG="${ERROR_LOG:-/opt/flamecrm/logs/error.log}"
ALERT_EMAIL="${ALERT_EMAIL:-}"

# Создаем директорию для логов если не существует
mkdir -p "$LOG_DIR"

# Функция для отправки алерта
send_alert() {
    local level=$1
    local message=$2
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message" >> "$ERROR_LOG"
    
    # Если настроен email, отправляем алерт
    if [ -n "$ALERT_EMAIL" ] && command -v mail &> /dev/null; then
        echo "$message" | mail -s "[Flame CRM] $level Alert" "$ALERT_EMAIL" 2>/dev/null || true
    fi
}

# Проверка логов на критические ошибки
check_critical_errors() {
    if [ -f "$APP_LOG" ]; then
        # Ищем критические ошибки за последние 5 минут
        local recent_errors=$(tail -1000 "$APP_LOG" | grep -i "fatal\|critical\|database.*error\|connection.*failed" | tail -10)
        
        if [ -n "$recent_errors" ]; then
            send_alert "CRITICAL" "Обнаружены критические ошибки в логах:\n$recent_errors"
        fi
    fi
}

# Проверка health check endpoint
check_health() {
    local health_url="${HEALTH_URL:-http://localhost:3000/api/health}"
    local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$health_url" 2>/dev/null || echo "000")
    
    if [ "$response" = "000" ] || [ "$response" = "503" ]; then
        send_alert "CRITICAL" "Health check failed: HTTP $response"
        return 1
    elif [ "$response" != "200" ]; then
        send_alert "WARNING" "Health check returned: HTTP $response"
        return 1
    fi
    
    # Проверяем детали health check
    local health_data=$(curl -s --max-time 5 "$health_url" 2>/dev/null || echo "{}")
    local status=$(echo "$health_data" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
    
    if [ "$status" = "unhealthy" ]; then
        send_alert "CRITICAL" "Health check status: UNHEALTHY"
        return 1
    elif [ "$status" = "degraded" ]; then
        send_alert "WARNING" "Health check status: DEGRADED"
        return 0
    fi
    
    return 0
}

# Проверка использования диска
check_disk_space() {
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -gt 90 ]; then
        send_alert "CRITICAL" "Диск заполнен на ${disk_usage}%"
    elif [ "$disk_usage" -gt 80 ]; then
        send_alert "WARNING" "Диск заполнен на ${disk_usage}%"
    fi
}

# Проверка использования памяти
check_memory() {
    local mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    
    if [ "$mem_usage" -gt 90 ]; then
        send_alert "WARNING" "Использование памяти: ${mem_usage}%"
    fi
}

# Проверка контейнеров Docker
check_containers() {
    if command -v docker-compose &> /dev/null; then
        cd /opt/flamecrm 2>/dev/null || return 0
        
        local app_status=$(docker-compose ps app 2>/dev/null | grep -c "Up" || echo "0")
        local db_status=$(docker-compose ps postgres 2>/dev/null | grep -c "Up" || echo "0")
        
        if [ "$app_status" -eq 0 ]; then
            send_alert "CRITICAL" "Контейнер приложения не запущен"
        fi
        
        if [ "$db_status" -eq 0 ]; then
            send_alert "CRITICAL" "Контейнер PostgreSQL не запущен"
        fi
    fi
}

# Основная функция
main() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] === Начало проверки мониторинга ===" >> "$LOG_DIR/monitor.log"
    
    check_health
    check_disk_space
    check_memory
    check_containers
    check_critical_errors
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] === Проверка завершена ===" >> "$LOG_DIR/monitor.log"
}

main

