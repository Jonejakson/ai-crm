#!/bin/bash

# Скрипт для деплоя CRM на Selectel через Docker
# Использование: ./scripts/deploy-selectel.sh

set -e  # Остановка при ошибке

echo "🚀 Начало деплоя CRM на Selectel"
echo ""

# Проверка, что мы в правильной директории
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Ошибка: docker-compose.yml не найден. Убедитесь, что вы в директории my-app"
    exit 1
fi

# Проверка наличия .env файла
if [ ! -f ".env" ]; then
    echo "⚠️  Файл .env не найден!"
    echo "📝 Создайте файл .env с необходимыми переменными окружения"
    echo ""
    echo "Минимальные переменные:"
    echo "  POSTGRES_PASSWORD=your_secure_password"
    echo "  NEXTAUTH_URL=https://your-domain.com"
    echo "  NEXTAUTH_SECRET=your-secret-key"
    echo ""
    read -p "Создать шаблон .env файла? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cat > .env << EOF
# Пароль для PostgreSQL (ОБЯЗАТЕЛЬНО!)
POSTGRES_PASSWORD=change_this_password_$(openssl rand -hex 8)

# NextAuth (ОБЯЗАТЕЛЬНО!)
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=$(openssl rand -base64 32)
AUTH_SECRET=$(openssl rand -base64 32)

# Шифрование (ОБЯЗАТЕЛЬНО для production!)
# Сгенерируйте: openssl rand -hex 32
ENCRYPTION_KEY=

# OpenAI API (опционально)
OPENAI_API_KEY=

# Email (опционально)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=

# DaData API (опционально)
DADATA_API_KEY=
DADATA_SECRET_KEY=

# Sentry (опционально)
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=

# YooKassa (опционально)
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=

# Node Environment
NODE_ENV=production
EOF
        echo "✅ Создан файл .env. Отредактируйте его перед продолжением!"
        echo "   nano .env"
        exit 0
    else
        echo "❌ Создайте .env файл вручную и запустите скрипт снова"
        exit 1
    fi
fi

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Установите Docker и запустите скрипт снова"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose не установлен. Установите Docker Compose и запустите скрипт снова"
    exit 1
fi

echo "✅ Проверки пройдены"
echo ""

# Остановка существующих контейнеров (если есть)
echo "🛑 Остановка существующих контейнеров..."
docker-compose down 2>/dev/null || true

# Сборка и запуск контейнеров
echo "🔨 Сборка Docker-образов..."
docker-compose build --no-cache

echo "🚀 Запуск контейнеров..."
docker-compose up -d

# Ожидание готовности PostgreSQL
echo "⏳ Ожидание готовности PostgreSQL..."
sleep 10

# Проверка статуса контейнеров
echo "📊 Статус контейнеров:"
docker-compose ps

# Применение миграций
echo ""
echo "📦 Применение миграций базы данных..."
docker-compose exec -T app npx prisma migrate deploy || {
    echo "⚠️  Ошибка при применении миграций. Попробуйте вручную:"
    echo "   docker-compose exec app npx prisma migrate deploy"
}

echo ""
echo "🔧 Генерация Prisma Client..."
docker-compose exec -T app npx prisma generate || {
    echo "⚠️  Ошибка при генерации Prisma Client. Попробуйте вручную:"
    echo "   docker-compose exec app npx prisma generate"
}

echo ""
echo "✅ Деплой завершен!"
echo ""
echo "📋 Следующие шаги:"
echo "   1. Проверьте логи: docker-compose logs -f app"
echo "   2. Настройте Nginx (см. DEPLOY_SELECTEL.md)"
echo "   3. Настройте SSL сертификат: sudo certbot --nginx -d your-domain.com"
echo "   4. Настройте домен в панели Selectel"
echo ""
echo "🌐 Приложение должно быть доступно на http://localhost:3000"
echo "   (или через Nginx на вашем домене)"


