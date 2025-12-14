# Пошаговая инструкция деплоя на сервер flame-prod

## Информация о сервере:
- **Имя:** flame-prod
- **IP:** 79.143.30.96
- **ОС:** Ubuntu 22.04 64bit
- **SSH:** `ssh root@79.143.30.96`

## Шаг 1: Подключение к серверу

Откройте терминал на вашем рабочем ПК и выполните:

```bash
ssh root@79.143.30.96
```

Если это первый раз, подтвердите подключение (введите `yes`).

## Шаг 2: Проверка текущего состояния

```bash
# Проверьте, установлен ли Docker
docker --version
docker-compose --version

# Проверьте, клонирован ли репозиторий
cd /opt/ai-crm/my-app
ls -la
```

Если репозиторий не клонирован или находится в другом месте, выполните:

```bash
cd /opt
git clone https://github.com/Jonejakson/ai-crm.git
cd ai-crm/my-app
```

## Шаг 3: Обновление кода

```bash
# Получите последние изменения из Git
git pull origin main

# Проверьте наличие Docker файлов
ls -la | grep -E "Dockerfile|docker-compose"
```

Должны быть видны:
- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`

## Шаг 4: Создание файла .env

```bash
nano .env
```

Скопируйте и вставьте следующий шаблон, **заменив значения на свои**:

```env
# Пароль для PostgreSQL (ОБЯЗАТЕЛЬНО! Сгенерируйте надежный пароль)
POSTGRES_PASSWORD=change_this_to_secure_password_$(openssl rand -hex 16)

# NextAuth (ОБЯЗАТЕЛЬНО!)
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Email (рекомендуется)
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
```

**Важно:**
- Замените `your-domain.com` на ваш реальный домен (или IP пока)
- Сгенерируйте пароли прямо в терминале:
  ```bash
  # Для POSTGRES_PASSWORD
  openssl rand -hex 16
  
  # Для NEXTAUTH_SECRET
  openssl rand -base64 32
  ```

Сохраните файл: `Ctrl+O`, затем `Enter`, затем `Ctrl+X`

## Шаг 5: Запуск деплоя

**Вариант А: Использование скрипта (рекомендуется)**

```bash
# Сделайте скрипт исполняемым
chmod +x scripts/deploy-selectel.sh

# Запустите скрипт
./scripts/deploy-selectel.sh
```

**Вариант Б: Вручную**

```bash
# Сборка и запуск контейнеров
docker-compose up -d --build

# Подождите 10-15 секунд для запуска PostgreSQL
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

## Шаг 6: Проверка работы приложения

```bash
# Проверка доступности
curl http://localhost:3000

# Или проверьте в браузере
# http://79.143.30.96:3000
```

Если видите HTML-ответ, приложение работает!

## Шаг 7: Настройка Nginx (реверс-прокси)

```bash
# Установка Nginx
sudo apt update
sudo apt install -y nginx

# Создание конфигурации
sudo nano /etc/nginx/sites-available/crm
```

Вставьте следующую конфигурацию:

```nginx
server {
    listen 80;
    server_name 79.143.30.96;  # Пока используем IP, потом замените на домен

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

Сохраните: `Ctrl+O`, `Enter`, `Ctrl+X`

Активация конфигурации:

```bash
# Удалите дефолтную конфигурацию
sudo rm /etc/nginx/sites-enabled/default

# Активируйте нашу конфигурацию
sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/

# Проверка конфигурации
sudo nginx -t

# Перезапуск Nginx
sudo systemctl restart nginx
```

Теперь приложение должно быть доступно по адресу: `http://79.143.30.96`

## Шаг 8: Настройка SSL (Let's Encrypt) - после настройки домена

Когда у вас будет домен, настроенный на этот IP:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Шаг 9: Настройка домена в Selectel

1. В панели Selectel перейдите в раздел **"ДОМЕНЫ"**
2. Добавьте или выберите ваш домен
3. Добавьте A-запись:
   - **Тип:** A
   - **Имя:** @ (или пусто)
   - **Значение:** `79.143.30.96`
4. Добавьте A-запись для www:
   - **Тип:** A
   - **Имя:** www
   - **Значение:** `79.143.30.96`

## Полезные команды для мониторинга

```bash
# Просмотр логов приложения
docker-compose logs -f app

# Просмотр логов PostgreSQL
docker-compose logs -f postgres

# Статус контейнеров
docker-compose ps

# Перезапуск приложения
docker-compose restart app

# Остановка всех контейнеров
docker-compose down

# Запуск контейнеров
docker-compose up -d
```

## Обновление приложения в будущем

```bash
cd /opt/ai-crm/my-app
git pull origin main
docker-compose up -d --build
docker-compose exec app npx prisma migrate deploy
```

## Устранение проблем

### Контейнеры не запускаются

```bash
docker-compose logs app
docker-compose ps
docker-compose restart
```

### Ошибки миграций

```bash
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma generate
```

### Проблемы с Nginx

```bash
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```


