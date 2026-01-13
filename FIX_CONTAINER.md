# Исправление проблемы с контейнером

## Проблема
Старый контейнер ссылается на удаленный образ Docker. Нужно удалить старый контейнер и пересобрать образ.

## Решение

Выполните команды на сервере:

```bash
# 1. Остановить и удалить старый контейнер
docker-compose down
docker rm -f 9ecde248e684_crm_app 2>/dev/null || true

# 2. Удалить старые образы (опционально, для очистки)
docker image prune -f

# 3. Пересобрать образ приложения
docker-compose build --no-cache app

# 4. Запустить контейнеры
docker-compose up -d

# 5. Проверить статус
docker-compose ps

# 6. Проверить логи, если что-то не так
docker-compose logs app
```

## Альтернативный вариант (быстрее, если образ уже есть)

```bash
# 1. Удалить только проблемный контейнер
docker rm -f 9ecde248e684_crm_app

# 2. Запустить заново (docker-compose пересоздаст контейнер)
docker-compose up -d app

# 3. Если не работает, пересобрать
docker-compose build app
docker-compose up -d app
```

## Проверка после исправления

```bash
# Проверить статус
docker-compose ps

# Проверить здоровье приложения
curl http://127.0.0.1:3000/api/health

# Проверить манифест
curl http://127.0.0.1:3000/manifest

# Перезагрузить Nginx
systemctl reload nginx
```













