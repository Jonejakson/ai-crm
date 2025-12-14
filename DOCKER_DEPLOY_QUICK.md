# Быстрый деплой на Selectel через Docker

## Предварительные требования

1. Сервер на Selectel с Ubuntu/Debian
2. Установленные Docker и Docker Compose
3. Доступ по SSH к серверу

## Шаги деплоя

### 1. Подключение к серверу

```bash
ssh user@your-server-ip
```

### 2. Установка Docker (если не установлен)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
# Переподключитесь к серверу после добавления в группу docker
```

### 3. Клонирование проекта

```bash
cd /opt
git clone https://github.com/Jonejakson/ai-crm.git
cd ai-crm/my-app
```

### 4. Создание .env файла

```bash
nano .env
```

Заполните следующие обязательные переменные:

```env
# Пароль для PostgreSQL (обязательно!)
POSTGRES_PASSWORD=your_very_secure_password_here

# NextAuth (обязательно!)
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=generate_random_secret_here

# База данных (для docker-compose автоматически)
# DATABASE_URL будет сформирован автоматически из POSTGRES_PASSWORD

# Email (опционально, но рекомендуется)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-email@gmail.com

# DaData API (опционально)
DADATA_API_KEY=your-key
DADATA_SECRET_KEY=your-secret

# Sentry (опционально)
SENTRY_DSN=your-dsn
NEXT_PUBLIC_SENTRY_DSN=your-dsn
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```

**Важно:** 
- `NEXTAUTH_SECRET` можно сгенерировать командой: `openssl rand -base64 32`
- `POSTGRES_PASSWORD` должен быть надежным паролем

### 5. Запуск приложения

```bash
# Сборка и запуск контейнеров
docker-compose up -d --build

# Проверка статуса
docker-compose ps

# Просмотр логов
docker-compose logs -f app
```

### 6. Применение миграций базы данных

```bash
# Применение миграций Prisma
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma generate
```

### 7. Настройка Nginx (реверс-прокси)

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/crm
```

Вставьте конфигурацию:

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

Активация конфигурации:

```bash
sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 8. Настройка SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certbot автоматически обновит конфигурацию Nginx для HTTPS.

### 9. Настройка домена в Selectel

1. Зайдите в панель управления Selectel
2. Перейдите в раздел "Домены"
3. Добавьте A-запись, указывающую на IP вашего сервера:
   ```
   A    @    your-server-ip
   A    www  your-server-ip
   ```

## Обновление приложения

```bash
cd /opt/ai-crm/my-app
git pull
docker-compose up -d --build
docker-compose exec app npx prisma migrate deploy
```

## Полезные команды

```bash
# Просмотр логов
docker-compose logs -f app
docker-compose logs -f postgres

# Остановка контейнеров
docker-compose down

# Перезапуск контейнеров
docker-compose restart

# Просмотр статуса
docker-compose ps

# Вход в контейнер приложения
docker-compose exec app sh

# Резервное копирование базы данных
docker-compose exec postgres pg_dump -U crm_user crm_db > backup_$(date +%Y%m%d).sql

# Восстановление базы данных
docker-compose exec -T postgres psql -U crm_user crm_db < backup_20240101.sql
```

## Устранение проблем

### Приложение не запускается

```bash
# Проверьте логи
docker-compose logs app

# Проверьте статус контейнеров
docker-compose ps

# Проверьте подключение к базе данных
docker-compose exec app npx prisma db pull
```

### Ошибки миграций

```bash
# Сброс базы данных (ОСТОРОЖНО: удалит все данные!)
docker-compose down -v
docker-compose up -d postgres
docker-compose exec app npx prisma migrate deploy
```

### Проблемы с портами

Если порт 3000 занят, измените в `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Внешний порт:внутренний порт
```

## Безопасность

1. Настройте firewall:
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

2. Используйте сильные пароли для `POSTGRES_PASSWORD` и `NEXTAUTH_SECRET`

3. Регулярно обновляйте систему:
```bash
sudo apt update && sudo apt upgrade -y
```

4. Настройте автоматические бэкапы базы данных


