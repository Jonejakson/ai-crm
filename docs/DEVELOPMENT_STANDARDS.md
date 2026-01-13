# Стандарты разработки и деплоя Flame CRM

## 📋 Последние изменения (с момента последней работы)

### ✅ Выполненные критичные задачи

1. **S3/File Storage (Selectel Object Storage)** ✅
   - Реализована интеграция с Selectel Object Storage
   - Файлы хранятся в S3 с fallback на локальное хранилище
   - Поддержка vHosted и Path-Style адресации
   - Файлы: `lib/storage.ts`, `app/api/files/*/route.ts`

2. **Резервное копирование БД** ✅
   - Автоматические ежедневные бэкапы PostgreSQL
   - Хранение бэкапов 7 дней (настраивается)
   - Загрузка бэкапов в S3 (опционально)
   - Скрипты: `scripts/backup-db.sh`, `scripts/restore-db.sh`, `scripts/setup-backup-cron.sh`

3. **Мониторинг и логирование** ✅
   - Health check endpoint: `/api/health`
   - Metrics endpoint: `/api/health/metrics`
   - Скрипт мониторинга: `scripts/monitor-logs.sh`
   - Структурированное логирование через `lib/logger.ts`

4. **Безопасность** ✅
   - Проверка `ENCRYPTION_KEY`
   - Rate limiting настроен в `middleware.ts`
   - Security headers (X-Frame-Options, CSP, HSTS)
   - Валидация входных данных через Zod
   - Скрипт проверки: `scripts/check-security.sh`

5. **Оптимизация производительности** ✅
   - Добавлено 34 индекса в БД
   - Оптимизированы N+1 запросы (используется `include` в Prisma)
   - Миграция: `prisma/migrations/20251230_add_performance_indexes/`

6. **Юридические документы** ✅
   - Обновлена политика конфиденциальности (`app/privacy/page.tsx`)
   - Обновлено пользовательское соглашение (`app/terms/page.tsx`)
   - Добавлены ФИО и ИНН оператора

### 📝 Текущие незакоммиченные изменения

- `docs/SELECTEL_S3_SETUP.md` - обновлена документация по S3
- `scripts/create-test-user-direct.sh` - изменения в скрипте создания тестового пользователя
- `scripts/create-test-user.sh` - изменения в скрипте создания тестового пользователя

---

## 🚀 Стандарты деплоя на сервер

### Сервер
- **IP:** 79.143.30.96
- **Пользователь:** root
- **Путь проекта:** `/opt/ai-crm/my-app` (или `/opt/flamecrm`)
- **Домен:** flamecrm.ru

### Процесс деплоя

#### 1. Локальная подготовка

```bash
# Проверить изменения
git status

# Добавить изменения
git add .

# Закоммитить с понятным сообщением
git commit -m "feat: описание изменений"

# Отправить на GitHub
git push origin main
```

#### 2. Деплой на сервер

**Вариант A: Автоматический (рекомендуется)**

```bash
# Подключиться к серверу
ssh root@79.143.30.96

# Перейти в директорию проекта
cd /opt/ai-crm/my-app  # или /opt/flamecrm

# Запустить скрипт обновления
chmod +x scripts/update-deploy.sh
./scripts/update-deploy.sh
```

**Вариант B: Ручной**

```bash
# На сервере
cd /opt/ai-crm/my-app
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
sleep 15
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma generate
docker-compose ps
docker-compose logs -f app
```

#### 3. Проверка после деплоя

```bash
# Проверить статус контейнеров
docker-compose ps

# Проверить health check
curl http://localhost:3000/api/health

# Проверить логи
docker-compose logs -f app
```

---

## 📁 Структура проекта

### Ключевые директории

- `app/` - Next.js App Router (страницы и API routes)
- `components/` - React компоненты
- `lib/` - Утилиты и библиотеки
  - `storage.ts` - работа с S3
  - `prisma.ts` - подключение к БД
  - `encryption.ts` - шифрование данных
  - `rate-limit.ts` - rate limiting
  - `logger.ts` - логирование
- `prisma/` - Prisma schema и миграции
- `scripts/` - bash и SQL скрипты
- `docs/` - документация

### Ключевые файлы

- `docker-compose.yml` - конфигурация Docker
- `Dockerfile` - образ приложения
- `middleware.ts` - Next.js middleware (auth, rate limiting, security headers)
- `.env` - переменные окружения (НЕ коммитится в Git!)

---

## 🔧 Переменные окружения

### Обязательные

```env
# База данных
DATABASE_URL=postgresql://crm_user:password@postgres:5432/crm_db

# NextAuth
NEXTAUTH_URL=https://flamecrm.ru
NEXTAUTH_SECRET=секретный_ключ_минимум_32_символа
AUTH_SECRET=секретный_ключ_минимум_32_символа

# Шифрование (ОБЯЗАТЕЛЬНО для production!)
ENCRYPTION_KEY=hex_ключ_64_символа

# Node Environment
NODE_ENV=production
```

### Опциональные

```env
# S3 / Selectel Object Storage
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=
S3_ENDPOINT=https://s3.selcdn.ru
S3_REGION=ru-7
S3_PUBLIC_URL=
S3_USE_VHOSTED=true

# OpenAI API
OPENAI_API_KEY=

# Email (SMTP)
MAIL_HOST=
MAIL_PORT=587
MAIL_USER=
MAIL_PASSWORD=
MAIL_FROM=

# DaData API
DADATA_API_KEY=
DADATA_SECRET_KEY=

# Sentry
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# YooKassa
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=
```

---

## 🔒 Безопасность

### Обязательные проверки перед деплоем

1. **ENCRYPTION_KEY** установлен и имеет длину минимум 32 символа
2. **NODE_ENV=production** в production окружении
3. **Все секреты** в `.env`, а не в коде
4. **Rate limiting** настроен в `middleware.ts`
5. **Security headers** установлены в `middleware.ts`

### Скрипт проверки безопасности

```bash
cd /opt/flamecrm
bash scripts/check-security.sh
```

---

## 📊 Мониторинг

### Health Check

```bash
curl http://localhost:3000/api/health
```

Проверяет:
- Подключение к БД
- Наличие ENCRYPTION_KEY
- Настройку S3 (если есть)
- Использование памяти

### Metrics

```bash
curl http://localhost:3000/api/health/metrics
```

Показывает:
- Использование памяти
- Uptime приложения
- Статистику БД

### Логи

```bash
# Логи приложения
docker-compose logs -f app

# Логи PostgreSQL
docker-compose logs -f postgres

# Логи мониторинга
tail -f /opt/flamecrm/logs/monitor.log
```

---

## 🗄️ База данных

### Миграции

```bash
# Создать новую миграцию (локально)
npm run db:migrate

# Применить миграции на сервере
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma generate
```

### Бэкапы

```bash
# Ручной бэкап
cd /opt/flamecrm
./scripts/backup-db.sh

# Восстановление
./scripts/restore-db.sh /path/to/backup.sql.gz
```

### Автоматические бэкапы

Настроены через cron (ежедневно в 2:00):
```bash
crontab -l  # Проверить задачи
```

---

## 📝 TODO в коде (требуют внимания)

1. **Email интеграции:**
   - `app/api/email-integrations/[id]/send/route.ts` - TODO: реализовать отправку через Gmail API
   - `lib/email/outlook-client.ts` - TODO: загружать вложения отдельным запросом
   - `lib/support/ticket-email-handler.ts` - TODO: отправить email уведомление пользователю

2. **Платежи:**
   - `lib/payment.ts` - TODO: проверить HMAC-SHA256 для YooKassa

---

## 🎯 Следующие шаги (из RELEASE_TODO.md)

### Осталось сделать

- [ ] Оптимизация bundle size
- [ ] Lazy loading для тяжелых компонентов
- [ ] Тестирование основных сценариев
- [ ] Тестирование интеграций

---

## 📚 Полезные команды

### Docker

```bash
# Перезапуск контейнеров
docker-compose restart

# Пересборка без кэша
docker-compose build --no-cache

# Просмотр логов
docker-compose logs -f app

# Выполнить команду в контейнере
docker-compose exec app <команда>

# Остановить все
docker-compose down

# Запустить все
docker-compose up -d
```

### Git

```bash
# Проверить статус
git status

# Посмотреть изменения
git diff

# Добавить все изменения
git add .

# Закоммитить
git commit -m "тип: описание"

# Отправить на сервер
git push origin main

# Получить изменения с сервера
git pull origin main
```

### База данных

```bash
# Подключиться к БД
docker-compose exec postgres psql -U crm_user -d crm_db

# Применить миграции
docker-compose exec app npx prisma migrate deploy

# Генерация Prisma Client
docker-compose exec app npx prisma generate

# Prisma Studio (GUI для БД)
docker-compose exec app npx prisma studio
```

---

## 🆘 Устранение проблем

### Приложение не запускается

1. Проверить логи: `docker-compose logs app`
2. Проверить статус контейнеров: `docker-compose ps`
3. Проверить переменные окружения: `docker-compose exec app env | grep -E 'DATABASE_URL|NEXTAUTH'`
4. Проверить подключение к БД: `docker-compose exec app npx prisma db pull`

### Ошибки миграций

1. Проверить, что БД доступна: `docker-compose ps postgres`
2. Проверить DATABASE_URL в `.env`
3. Применить миграции вручную: `docker-compose exec app npx prisma migrate deploy`

### Проблемы с S3

1. Проверить переменные S3: `docker-compose exec app env | grep S3_`
2. Проверить логи: `docker-compose logs app | grep -i s3`
3. Проверить права доступа ключей в панели Selectel

---

## 📞 Контакты и ссылки

- **Домен:** https://flamecrm.ru
- **Health Check:** https://flamecrm.ru/api/health
- **Документация Selectel:** https://docs.selectel.com/storage/s3/
- **Документация Prisma:** https://www.prisma.io/docs/

---

**Последнее обновление:** 2025-01-27
