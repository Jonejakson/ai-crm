# Руководство по деплою CRM System

## Подготовка к деплою

### 1. Переменные окружения

Создайте файл `.env` на основе `.env.example` и заполните все обязательные переменные:

```bash
cp .env.example .env
```

**Обязательные переменные:**
- `DATABASE_URL` - строка подключения к PostgreSQL
- `AUTH_SECRET` или `NEXTAUTH_SECRET` - секретный ключ для JWT (минимум 32 символа)
- `NEXTAUTH_URL` - URL вашего приложения

**Опциональные переменные:**
- `OPENAI_API_KEY` - для работы AI ассистента (если не указан, работает в demo режиме)
- `NODE_ENV` - окружение (development/production)

### 2. Генерация AUTH_SECRET

Сгенерируйте безопасный секретный ключ:

```bash
# Linux/Mac
openssl rand -base64 32

# Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

Или используйте онлайн генератор: https://generate-secret.vercel.app/32

### 3. Настройка базы данных

#### Локальная база данных (для разработки)

```bash
# Создать базу данных
npm run db:create

# Применить миграции
npm run db:migrate:postgres
```

#### Удаленная база данных (для продакшена)

1. Создайте базу данных на вашем хостинге (например, Railway, Supabase, Neon, etc.)
2. Получите строку подключения `DATABASE_URL`
3. Обновите `.env` файл с правильным `DATABASE_URL`

### 4. Применение миграций в продакшене

```bash
# Применить миграции без создания новых
npm run db:deploy
```

## Варианты деплоя

### Vercel (Рекомендуется)

1. **Подключите репозиторий:**
   - Зайдите на https://vercel.com
   - Импортируйте ваш Git репозиторий

2. **Настройте переменные окружения:**
   - В настройках проекта → Environment Variables
   - Добавьте все переменные из `.env.example`

3. **Настройте базу данных:**
   - Используйте Vercel Postgres или внешний PostgreSQL
   - Добавьте `DATABASE_URL` в переменные окружения

4. **Деплой:**
   - Vercel автоматически определит Next.js проект
   - Примените миграции через Vercel CLI:
     ```bash
     vercel env pull .env.local
     npm run db:deploy
     ```

### Railway

1. **Создайте проект:**
   - Зайдите на https://railway.app
   - Создайте новый проект из Git репозитория

2. **Добавьте PostgreSQL:**
   - В проекте → New → Database → PostgreSQL
   - Railway автоматически создаст `DATABASE_URL`

3. **Настройте переменные окружения:**
   - В настройках проекта → Variables
   - Добавьте `AUTH_SECRET`, `NEXTAUTH_URL`, `OPENAI_API_KEY`

4. **Примените миграции:**
   - Railway автоматически выполнит `postinstall` скрипт (генерирует Prisma Client)
   - Для миграций добавьте команду в настройках:
     ```bash
     npx prisma migrate deploy
     ```

### Docker

1. **Создайте Dockerfile:**

```dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

2. **Создайте docker-compose.yml:**

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - AUTH_SECRET=${AUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=your_password
      - POSTGRES_DB=crm_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

3. **Запуск:**

```bash
docker-compose up -d
```

### VPS (Ubuntu/Debian)

1. **Установите зависимости:**

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# PM2 для управления процессом
sudo npm install -g pm2
```

2. **Настройте базу данных:**

```bash
sudo -u postgres psql
CREATE DATABASE crm_db;
CREATE USER crm_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE crm_db TO crm_user;
\q
```

3. **Клонируйте и настройте проект:**

```bash
git clone your-repo-url
cd my-app
npm install
cp .env.example .env
# Отредактируйте .env
```

4. **Примените миграции:**

```bash
npm run db:deploy
```

5. **Соберите проект:**

```bash
npm run build
```

6. **Запустите с PM2:**

```bash
pm2 start npm --name "crm-system" -- start
pm2 save
pm2 startup
```

7. **Настройте Nginx (опционально):**

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Проверка после деплоя

1. **Проверьте подключение к базе данных:**
   ```bash
   npm run db:studio
   ```

2. **Проверьте переменные окружения:**
   - Убедитесь, что все переменные установлены
   - Проверьте, что `NEXTAUTH_URL` указывает на правильный домен

3. **Проверьте работу приложения:**
   - Откройте главную страницу
   - Попробуйте зарегистрироваться
   - Проверьте работу AI ассистента

## Безопасность

- ✅ Никогда не коммитьте `.env` файл в Git
- ✅ Используйте сильные пароли для базы данных
- ✅ Генерируйте уникальный `AUTH_SECRET` для каждого окружения
- ✅ Используйте HTTPS в продакшене
- ✅ Регулярно обновляйте зависимости: `npm audit fix`

## Мониторинг

Рекомендуется настроить мониторинг для:
- Доступности приложения
- Использования ресурсов (CPU, память)
- Ошибок в логах
- Производительности базы данных

## Поддержка

При возникновении проблем:
1. Проверьте логи приложения
2. Проверьте подключение к базе данных
3. Убедитесь, что все переменные окружения установлены
4. См. `docs/TROUBLESHOOTING.md` для решения частых проблем


