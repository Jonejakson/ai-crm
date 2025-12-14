# Что делать после подключения к серверу

## Шаг 1: Подключитесь к серверу

В Git Bash выполните:

```bash
ssh -i ~/.ssh/id_ed25519_this_pc root@79.143.30.96
```

Или в PowerShell:

```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_this_pc" root@79.143.30.96
```

После успешного подключения вы увидите приглашение:
```
root@flame-prod:~#
```

---

## Шаг 2: Проверьте текущее состояние

```bash
# Проверьте, установлен ли Docker
docker --version
docker-compose --version

# Проверьте, клонирован ли репозиторий
ls -la /opt/ai-crm/my-app
```

---

## Шаг 3: Клонирование или обновление репозитория

### Если репозиторий НЕ клонирован:

```bash
cd /opt
git clone https://github.com/Jonejakson/ai-crm.git
cd ai-crm/my-app
```

### Если репозиторий УЖЕ клонирован:

```bash
cd /opt/ai-crm/my-app
git pull origin main
```

---

## Шаг 4: Проверьте наличие Docker файлов

```bash
# Должны быть видны:
ls -la | grep -E "Dockerfile|docker-compose"

# Должны быть:
# - Dockerfile
# - docker-compose.yml
# - .dockerignore
```

Если файлов нет, значит код не обновился. Выполните:
```bash
git pull origin main
```

---

## Шаг 5: Создайте файл .env

```bash
nano .env
```

Скопируйте и вставьте следующий шаблон, **заменив значения на свои**:

```env
# Пароль для PostgreSQL (ОБЯЗАТЕЛЬНО! Сгенерируйте надежный пароль)
POSTGRES_PASSWORD=your_very_secure_password_here

# NextAuth (ОБЯЗАТЕЛЬНО!)
NEXTAUTH_URL=http://79.143.30.96
NEXTAUTH_SECRET=your-secret-key-here

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
- `POSTGRES_PASSWORD` - сгенерируйте надежный пароль:
  ```bash
  openssl rand -hex 16
  ```
- `NEXTAUTH_SECRET` - сгенерируйте секретный ключ:
  ```bash
  openssl rand -base64 32
  ```
- `NEXTAUTH_URL` - пока используйте IP, потом замените на домен

Сохраните файл: `Ctrl+O`, затем `Enter`, затем `Ctrl+X`

---

## Шаг 6: Запустите деплой

### Вариант А: Использование скрипта (если он есть)

```bash
chmod +x scripts/deploy-selectel.sh
./scripts/deploy-selectel.sh
```

### Вариант Б: Вручную

```bash
# Сборка и запуск контейнеров
docker-compose up -d --build

# Подождите 15 секунд для запуска PostgreSQL
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

---

## Шаг 7: Проверьте работу приложения

```bash
# Проверка доступности
curl http://localhost:3000

# Или откройте в браузере
# http://79.143.30.96:3000
```

Если видите HTML-ответ, приложение работает! 🎉

---

## Шаг 8: Настройте Nginx (реверс-прокси)

```bash
# Установка Nginx
apt update
apt install -y nginx

# Создание конфигурации
nano /etc/nginx/sites-available/crm
```

Вставьте следующую конфигурацию:

```nginx
server {
    listen 80;
    server_name 79.143.30.96;

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
rm /etc/nginx/sites-enabled/default

# Активируйте нашу конфигурацию
ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/

# Проверка конфигурации
nginx -t

# Перезапуск Nginx
systemctl restart nginx
```

Теперь приложение должно быть доступно по адресу: `http://79.143.30.96`

---

## Шаг 9: Настройка SSL (после настройки домена)

Когда у вас будет домен, настроенный на этот IP:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

---

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

---

## Обновление приложения в будущем

```bash
cd /opt/ai-crm/my-app
git pull origin main
docker-compose up -d --build
docker-compose exec app npx prisma migrate deploy
```

---

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
nginx -t
systemctl status nginx
tail -f /var/log/nginx/error.log
```

---

## Итоговый чеклист

- [ ] Подключились к серверу по SSH
- [ ] Клонировали/обновили репозиторий
- [ ] Создали файл `.env` с правильными значениями
- [ ] Запустили `docker-compose up -d --build`
- [ ] Применили миграции: `docker-compose exec app npx prisma migrate deploy`
- [ ] Проверили работу: `curl http://localhost:3000`
- [ ] Настроили Nginx
- [ ] Приложение доступно по IP или домену

После выполнения всех шагов ваше приложение будет работать! 🚀


