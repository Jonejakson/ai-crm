#!/bin/bash
# Скрипт для настройки AWS CLI для работы с Selectel Object Storage

set -e

echo "=== Настройка AWS CLI для Selectel Object Storage ==="

# Проверяем, установлен ли AWS CLI
if ! command -v aws &> /dev/null; then
    echo "Установка AWS CLI..."
    apt-get update
    apt-get install -y awscli
fi

# Проверяем версию
echo "Версия AWS CLI:"
aws --version

# Загружаем переменные из .env
if [ -f /opt/flamecrm/.env ]; then
    source /opt/flamecrm/.env
    export S3_ACCESS_KEY_ID
    export S3_SECRET_ACCESS_KEY
    export S3_BUCKET_NAME
    export S3_ENDPOINT
    export S3_REGION
fi

# Проверяем наличие переменных
if [ -z "$S3_ACCESS_KEY_ID" ] || [ -z "$S3_SECRET_ACCESS_KEY" ] || [ -z "$S3_BUCKET_NAME" ]; then
    echo "ОШИБКА: Переменные S3 не настроены в .env"
    echo "Нужны: S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME"
    exit 1
fi

echo ""
echo "Настройка AWS CLI для Selectel..."
echo "Access Key ID: ${S3_ACCESS_KEY_ID:0:10}..."
echo "Bucket: $S3_BUCKET_NAME"
echo "Endpoint: ${S3_ENDPOINT:-https://s3.selcdn.ru}"
echo "Region: ${S3_REGION:-ru-7}"
echo ""

# Тестируем подключение
echo "Тестирование подключения к S3..."
export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="${S3_REGION:-ru-7}"

if aws s3 ls "s3://$S3_BUCKET_NAME" \
    --endpoint-url="${S3_ENDPOINT:-https://s3.selcdn.ru}" \
    --region="${S3_REGION:-ru-7}" \
    > /dev/null 2>&1; then
    echo "✅ Подключение к S3 успешно!"
    echo ""
    echo "Содержимое бакета:"
    aws s3 ls "s3://$S3_BUCKET_NAME" \
        --endpoint-url="${S3_ENDPOINT:-https://s3.selcdn.ru}" \
        --region="${S3_REGION:-ru-7}" \
        --recursive | head -10 || echo "Бакет пуст"
else
    echo "❌ ОШИБКА: Не удалось подключиться к S3"
    echo "Проверьте:"
    echo "  1. Правильность Access Key ID и Secret Access Key"
    echo "  2. Существование бакета: $S3_BUCKET_NAME"
    echo "  3. Права доступа ключа"
    exit 1
fi

echo ""
echo "=== Настройка завершена ==="
echo ""
echo "Теперь бэкапы будут автоматически загружаться в S3 при выполнении:"
echo "  /opt/flamecrm/scripts/backup-db.sh"

