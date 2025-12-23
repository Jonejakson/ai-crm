# Инструкция по обновлению деплоя на сервере Selectel

## Быстрое обновление

### 1. Подключитесь к серверу

```bash
ssh root@79.143.30.96
```

### 2. Перейдите в директорию проекта

```bash
cd /opt/ai-crm/my-app
```

### 3. Запустите скрипт обновления

```bash
chmod +x scripts/update-deploy.sh
./scripts/update-deploy.sh
```

## Или выполните вручную:

```bash
# 1. Обновите код
cd /opt/ai-crm/my-app
git pull origin main

# 2. Пересоберите и перезапустите контейнеры
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 3. Дождитесь запуска (15 секунд)
sleep 15

# 4. Примените миграции
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma generate

# 5. Проверьте статус
docker-compose ps
docker-compose logs -f app
```

## Проверка работы

После обновления проверьте:

```bash
# Статус контейнеров
docker-compose ps

# Логи приложения
docker-compose logs -f app

# Проверка здоровья
curl http://localhost:3000/api/health
```

## Что было обновлено

✅ Исправлена проверка роли `owner` на странице компании  
✅ Разрешен конфликт в `Sidebar.tsx`  
✅ Добавлен скрипт автоматического обновления




