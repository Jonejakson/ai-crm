# Продолжение деплоя на Selectel VDS

## 📍 Текущее состояние

Вы переносите проект с Vercel на Selectel VDS через Docker. Этот документ поможет продолжить деплой.

## 🔍 Шаг 1: Проверка текущего состояния

Подключитесь к серверу и выполните скрипт проверки:

```bash
# Подключение к серверу
ssh root@79.143.30.96

# Переход в директорию проекта
cd /opt/ai-crm/my-app

# Запуск проверки (если скрипт уже есть)
chmod +x scripts/check-deployment.sh
./scripts/check-deployment.sh
```

Скрипт проверит:
- ✅ Установлен ли Docker
- ✅ Клонирован ли репозиторий
- ✅ Наличие Docker файлов
- ✅ Наличие и корректность .env файла
- ✅ Статус контейнеров
- ✅ Доступность приложения
- ✅ Состояние базы данных
- ✅ Настройку Nginx

## 📝 Шаг 2: Создание/проверка .env файла

Если файл `.env` отсутствует или неполный:

```bash
cd /opt/ai-crm/my-app
nano .env
```

**Обязательные переменные для production:**

```env
# Пароль для PostgreSQL (ОБЯЗАТЕЛЬНО!)
POSTGRES_PASSWORD=your_very_secure_password_here

# NextAuth (ОБЯЗАТЕЛЬНО!)
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret-key-here
AUTH_SECRET=your-secret-key-here

# Шифрование (ОБЯЗАТЕЛЬНО для production!)
ENCRYPTION_KEY=your_64_char_hex_key_here

# OpenAI API (опционально)
OPENAI_API_KEY=your-openai-key

# Email (опционально)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-email@gmail.com

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
```

**Генерация секретных ключей:**

```bash
# Генерация NEXTAUTH_SECRET
openssl rand -base64 32

# Генерация ENCRYPTION_KEY (64 символа hex)
openssl rand -hex 32

# Генерация POSTGRES_PASSWORD
openssl rand -hex 16
```

## 🚀 Шаг 3: Запуск деплоя

### Вариант А: Использование скрипта деплоя

```bash
cd /opt/ai-crm/my-app
chmod +x scripts/deploy-selectel.sh
./scripts/deploy-selectel.sh
```

### Вариант Б: Ручной запуск

```bash
cd /opt/ai-crm/my-app

# Остановка существующих контейнеров (если есть)
docker-compose down

# Сборка и запуск контейнеров
docker-compose up -d --build

# Ожидание запуска PostgreSQL (15 секунд)
sleep 15

# Проверка статуса
docker-compose ps

# Применение миграций базы данных
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma generate

# Проверка логов
docker-compose logs -f app
```

Нажмите `Ctrl+C` чтобы выйти из просмотра логов.

## ✅ Шаг 4: Проверка работы приложения

```bash
# Проверка доступности
curl http://localhost:3000/api/health

# Или откройте в браузере
# http://79.143.30.96:3000
```

Если видите ответ, приложение работает! 🎉

## 🌐 Шаг 5: Настройка Nginx (если еще не настроен)

```bash
# Установка Nginx (если не установлен)
apt update
apt install -y nginx

# Создание конфигурации
nano /etc/nginx/sites-available/crm
```

Вставьте конфигурацию:

```nginx
server {
    listen 80;
    server_name your-domain.com 79.143.30.96;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активация:

```bash
# Удаление дефолтной конфигурации
rm -f /etc/nginx/sites-enabled/default

# Активация нашей конфигурации
ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/

# Проверка конфигурации
nginx -t

# Перезапуск Nginx
systemctl restart nginx
```

## 🔒 Шаг 6: Настройка SSL (после настройки домена)

Когда домен будет настроен на IP сервера:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

Certbot автоматически обновит конфигурацию Nginx для HTTPS.

## 📋 Чеклист продолжения деплоя

- [ ] Подключились к серверу по SSH
- [ ] Запустили скрипт проверки: `./scripts/check-deployment.sh`
- [ ] Проверили/создали файл `.env` с обязательными переменными:
  - [ ] `POSTGRES_PASSWORD`
  - [ ] `NEXTAUTH_URL`
  - [ ] `NEXTAUTH_SECRET` / `AUTH_SECRET`
  - [ ] `ENCRYPTION_KEY` (критично!)
- [ ] Запустили деплой: `docker-compose up -d --build`
- [ ] Применили миграции: `docker-compose exec app npx prisma migrate deploy`
- [ ] Проверили работу: `curl http://localhost:3000/api/health`
- [ ] Настроили Nginx (если нужно)
- [ ] Настроили SSL сертификат (после настройки домена)
- [ ] Настроили домен в панели Selectel

## 🆘 Устранение проблем

### Контейнеры не запускаются

```bash
# Проверка логов
docker-compose logs app
docker-compose logs postgres

# Проверка статуса
docker-compose ps

# Перезапуск
docker-compose restart
```

### Ошибки миграций

```bash
# Применение миграций вручную
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma generate

# Проверка подключения к БД
docker-compose exec app npx prisma db pull
```

### Проблемы с переменными окружения

```bash
# Проверка переменных в контейнере
docker-compose exec app env | grep -E 'DATABASE_URL|NEXTAUTH|ENCRYPTION_KEY'

# Пересоздание контейнеров с новыми переменными
docker-compose down
docker-compose up -d --build
```

### Приложение не отвечает

```bash
# Проверка логов
docker-compose logs -f app

# Проверка здоровья
curl http://localhost:3000/api/health

# Проверка портов
netstat -tlnp | grep 3000
```

## 📚 Полезные команды

```bash
# Просмотр логов
docker-compose logs -f app
docker-compose logs -f postgres

# Статус контейнеров
docker-compose ps

# Перезапуск приложения
docker-compose restart app

# Остановка всех контейнеров
docker-compose down

# Запуск контейнеров
docker-compose up -d

# Вход в контейнер приложения
docker-compose exec app sh

# Резервное копирование БД
docker-compose exec postgres pg_dump -U crm_user crm_db > backup_$(date +%Y%m%d).sql

# Восстановление БД
docker-compose exec -T postgres psql -U crm_user crm_db < backup_20240101.sql
```

## 🔄 Обновление приложения в будущем

```bash
cd /opt/ai-crm/my-app
git pull origin main
docker-compose up -d --build
docker-compose exec app npx prisma migrate deploy
```

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи: `docker-compose logs app`
2. Запустите скрипт проверки: `./scripts/check-deployment.sh`
3. Проверьте документацию: `DEPLOY_SELECTEL.md`, `DOCKER_DEPLOY_QUICK.md`

