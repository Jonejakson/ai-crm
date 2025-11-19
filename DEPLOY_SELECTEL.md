# Инструкция по деплою CRM на Selectel

## Вариант 1: Деплой через Docker (рекомендуется)

### 1. Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker и Docker Compose
sudo apt install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker
```

### 2. Клонирование репозитория

```bash
cd /opt
git clone https://github.com/Jonejakson/ai-crm.git
cd ai-crm/my-app
```

### 3. Создание файла `.env`

```bash
cp .env.example .env
nano .env
```

Заполните следующие переменные:

```env
# База данных
DATABASE_URL="postgresql://user:password@localhost:5432/crm_db?schema=public"

# NextAuth
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-secret-key-here"

# Email (опционально)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-password"
SMTP_FROM="your-email@gmail.com"

# DaData API (опционально)
DADATA_API_KEY="your-dadata-key"
DADATA_SECRET_KEY="your-dadata-secret"
```

### 4. Создание Dockerfile

Создайте файл `Dockerfile` в корне проекта:

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

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### 5. Обновление next.config.js

Убедитесь, что в `next.config.js` включен standalone режим:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // ... остальные настройки
}

module.exports = nextConfig
```

### 6. Создание docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: crm_user
      POSTGRES_PASSWORD: your_secure_password
      POSTGRES_DB: crm_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://crm_user:your_secure_password@postgres:5432/crm_db?schema=public
      NEXTAUTH_URL: https://your-domain.com
      NEXTAUTH_SECRET: your-secret-key-here
    depends_on:
      - postgres
    restart: unless-stopped

volumes:
  postgres_data:
```

### 7. Запуск приложения

```bash
# Сборка и запуск
docker-compose up -d --build

# Применение миграций Prisma
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma generate
```

### 8. Настройка Nginx (реверс-прокси)

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/crm
```

Конфигурация Nginx:

```nginx
server {
    listen 80;
    server_name your-domain.com;

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

```bash
sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 9. Настройка SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Вариант 2: Деплой без Docker

### 1. Установка Node.js и PostgreSQL

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Настройка базы данных

```bash
sudo -u postgres psql
CREATE DATABASE crm_db;
CREATE USER crm_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE crm_db TO crm_user;
\q
```

### 3. Клонирование и установка

```bash
cd /opt
git clone https://github.com/Jonejakson/ai-crm.git
cd ai-crm/my-app
npm install
```

### 4. Настройка переменных окружения

```bash
cp .env.example .env
nano .env
# Заполните переменные как в варианте 1
```

### 5. Применение миграций

```bash
npx prisma migrate deploy
npx prisma generate
```

### 6. Сборка и запуск

```bash
npm run build
npm start
```

### 7. Настройка PM2 (для автозапуска)

```bash
npm install -g pm2
pm2 start npm --name "crm" -- start
pm2 save
pm2 startup
```

## Настройка домена в Selectel

1. Зайдите в панель управления Selectel
2. Перейдите в раздел "Домены"
3. Добавьте ваш домен или используйте поддомен
4. Настройте A-запись, указывающую на IP вашего сервера

## Мониторинг и логи

```bash
# Docker
docker-compose logs -f app

# PM2
pm2 logs crm
pm2 monit
```

## Обновление приложения

```bash
# Docker
cd /opt/ai-crm/my-app
git pull
docker-compose up -d --build
docker-compose exec app npx prisma migrate deploy

# PM2
cd /opt/ai-crm/my-app
git pull
npm install
npm run build
pm2 restart crm
```

## Резервное копирование

```bash
# Создание бэкапа базы данных
docker-compose exec postgres pg_dump -U crm_user crm_db > backup_$(date +%Y%m%d).sql

# Восстановление
docker-compose exec -T postgres psql -U crm_user crm_db < backup_20240101.sql
```

## Безопасность

1. Настройте firewall:
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

2. Регулярно обновляйте систему:
```bash
sudo apt update && sudo apt upgrade -y
```

3. Используйте сильные пароли для базы данных и секретных ключей

## Поддержка

При возникновении проблем проверьте:
- Логи приложения
- Логи Nginx: `sudo tail -f /var/log/nginx/error.log`
- Статус сервисов: `docker-compose ps` или `pm2 status`

