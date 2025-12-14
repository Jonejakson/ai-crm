# Следующие шаги деплоя на Selectel

## ✅ Уже выполнено:
1. ✅ Установка Docker и Docker Compose на сервере Selectel
2. ✅ Клонирование репозитория: `git clone https://github.com/Jonejakson/ai-crm.git`

## 📋 Что делать дальше:

### Шаг 1: Подключитесь к серверу Selectel

```bash
ssh user@your-server-ip
cd /opt/ai-crm/my-app
```

### Шаг 2: Обновите код на сервере

```bash
# Получите последние изменения из Git
git pull origin main
```

### Шаг 3: Создайте файл `.env`

```bash
nano .env
```

Скопируйте и заполните следующий шаблон:

```env
# Пароль для PostgreSQL (ОБЯЗАТЕЛЬНО! Сгенерируйте надежный пароль)
POSTGRES_PASSWORD=your_very_secure_password_here

# NextAuth (ОБЯЗАТЕЛЬНО!)
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret-key-here

# Email (рекомендуется)
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
- `POSTGRES_PASSWORD` - сгенерируйте надежный пароль: `openssl rand -hex 16`
- `NEXTAUTH_SECRET` - сгенерируйте секретный ключ: `openssl rand -base64 32`
- `NEXTAUTH_URL` - замените `your-domain.com` на ваш реальный домен

### Шаг 4: Запустите деплой

**Вариант А: Использование скрипта (рекомендуется)**

```bash
chmod +x scripts/deploy-selectel.sh
./scripts/deploy-selectel.sh
```

**Вариант Б: Вручную**

```bash
# Сборка и запуск контейнеров
docker-compose up -d --build

# Проверка статуса
docker-compose ps

# Применение миграций базы данных
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma generate

# Проверка логов
docker-compose logs -f app
```

### Шаг 5: Проверьте работу приложения

```bash
# Проверка доступности
curl http://localhost:3000

# Или откройте в браузере (если есть доступ)
# http://your-server-ip:3000
```

### Шаг 6: Настройте Nginx (реверс-прокси)

```bash
# Установка Nginx
sudo apt install -y nginx

# Создание конфигурации
sudo nano /etc/nginx/sites-available/crm
```

Вставьте следующую конфигурацию (замените `your-domain.com` на ваш домен):

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

### Шаг 7: Настройте SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certbot автоматически настроит HTTPS и обновит конфигурацию Nginx.

### Шаг 8: Настройте домен в панели Selectel

1. Зайдите в панель управления Selectel
2. Перейдите в раздел "Домены"
3. Добавьте A-запись:
   - **Тип:** A
   - **Имя:** @ (или пусто для основного домена)
   - **Значение:** IP адрес вашего сервера
4. Добавьте A-запись для www:
   - **Тип:** A
   - **Имя:** www
   - **Значение:** IP адрес вашего сервера

Подождите 5-30 минут для распространения DNS записей.

### Шаг 9: Финальная проверка

- [ ] Откройте `https://your-domain.com` в браузере
- [ ] Проверьте вход в систему
- [ ] Проверьте работу основных функций
- [ ] Проверьте логи на ошибки: `docker-compose logs app`

## 🆘 Если что-то пошло не так:

### Проблема: Контейнеры не запускаются

```bash
# Проверьте логи
docker-compose logs app
docker-compose logs postgres

# Проверьте статус
docker-compose ps

# Перезапустите контейнеры
docker-compose restart
```

### Проблема: Ошибки миграций

```bash
# Проверьте подключение к БД
docker-compose exec app npx prisma db pull

# Примените миграции вручную
docker-compose exec app npx prisma migrate deploy
```

### Проблема: Приложение не доступно через домен

```bash
# Проверьте Nginx
sudo nginx -t
sudo systemctl status nginx

# Проверьте логи Nginx
sudo tail -f /var/log/nginx/error.log

# Проверьте firewall
sudo ufw status
```

## 📚 Дополнительные ресурсы:

- Полная инструкция: `DEPLOY_SELECTEL.md`
- Быстрый старт: `DOCKER_DEPLOY_QUICK.md`
- Чеклист: `DEPLOY_CHECKLIST.md`

## 🔄 Обновление приложения в будущем:

```bash
cd /opt/ai-crm/my-app
git pull origin main
docker-compose up -d --build
docker-compose exec app npx prisma migrate deploy
```


