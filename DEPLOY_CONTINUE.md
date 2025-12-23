# 🚀 Продолжение деплоя на Selectel VDS

## Быстрый старт

### 1. Подключитесь к серверу

```bash
ssh root@79.143.30.96
```

### 2. Перейдите в директорию проекта

```bash
cd /opt/ai-crm/my-app
```

Если репозиторий не клонирован:
```bash
cd /opt
git clone https://github.com/Jonejakson/ai-crm.git
cd ai-crm/my-app
```

### 3. Проверьте текущее состояние

```bash
chmod +x scripts/check-deployment.sh
./scripts/check-deployment.sh
```

### 4. Создайте/проверьте .env файл

```bash
nano .env
```

**Минимальные обязательные переменные:**

```env
POSTGRES_PASSWORD=your_secure_password
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your_secret_key
AUTH_SECRET=your_secret_key
ENCRYPTION_KEY=your_64_char_hex_key
NODE_ENV=production
```

**Генерация ключей:**
```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# ENCRYPTION_KEY (64 символа hex)
openssl rand -hex 32

# POSTGRES_PASSWORD
openssl rand -hex 16
```

### 5. Запустите деплой

```bash
chmod +x scripts/deploy-selectel.sh
./scripts/deploy-selectel.sh
```

Или вручную:
```bash
docker-compose up -d --build
sleep 15
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma generate
```

### 6. Проверьте работу

```bash
curl http://localhost:3000/api/health
docker-compose logs -f app
```

## 📋 Что было обновлено

✅ **docker-compose.yml** - добавлены все необходимые переменные окружения:
- `ENCRYPTION_KEY` (обязательно для production)
- `OPENAI_API_KEY`
- `YOOKASSA_SHOP_ID` и `YOOKASSA_SECRET_KEY`
- `AUTH_SECRET` (дублирует NEXTAUTH_SECRET)

✅ **scripts/check-deployment.sh** - новый скрипт для проверки состояния деплоя

✅ **scripts/deploy-selectel.sh** - обновлен с поддержкой ENCRYPTION_KEY

✅ **CONTINUE_DEPLOYMENT.md** - подробная инструкция по продолжению деплоя

## 🔍 Проверка после деплоя

```bash
# Статус контейнеров
docker-compose ps

# Логи приложения
docker-compose logs -f app

# Проверка здоровья
curl http://localhost:3000/api/health
```

## 🆘 Если что-то пошло не так

1. Проверьте логи: `docker-compose logs app`
2. Запустите скрипт проверки: `./scripts/check-deployment.sh`
3. См. подробную инструкцию: `CONTINUE_DEPLOYMENT.md`

## 📚 Дополнительная документация

- `CONTINUE_DEPLOYMENT.md` - подробная инструкция
- `DEPLOY_SELECTEL.md` - полная инструкция по деплою
- `DOCKER_DEPLOY_QUICK.md` - быстрый деплой
- `DEPLOY_CHECKLIST.md` - чеклист деплоя







