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

### 4. Проверка Docker-файлов

Убедитесь, что в проекте есть следующие файлы (они уже созданы):
- `Dockerfile` - для сборки Docker-образа приложения
- `docker-compose.yml` - для оркестрации контейнеров
- `.dockerignore` - для оптимизации сборки
- `next.config.ts` - уже настроен с `output: 'standalone'`

### 5. Настройка переменных окружения для Docker

Создайте файл `.env` в корне проекта (или используйте существующий):

Файл `docker-compose.yml` уже создан и настроен. В нем используются переменные из `.env` файла.

**Важно:** В `.env` файле должны быть указаны следующие переменные для Docker:

```env
# Пароль для PostgreSQL (используется в docker-compose.yml)
POSTGRES_PASSWORD=your_secure_password_here

# NextAuth
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret-key-here

# Email (опционально)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-password
SMTP_FROM=your-email@gmail.com

# DaData API (опционально)
DADATA_API_KEY=your-dadata-key
DADATA_SECRET_KEY=your-dadata-secret

# Sentry (опционально)
SENTRY_DSN=your-sentry-dsn
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```

### 6. Запуск приложения

```bash
# Сборка и запуск контейнеров
docker-compose up -d --build

# Дождитесь запуска PostgreSQL (проверка здоровья)
docker-compose ps

# Применение миграций Prisma
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma generate

# Проверка логов
docker-compose logs -f app
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

