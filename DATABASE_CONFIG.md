# Конфигурация базы данных

## Текущая рабочая конфигурация

### База данных
- **Имя БД:** `crm_db`
- **Пользователь:** `crm_user`
- **Пароль:** (хранится в `.env` на сервере)
- **Хост:** `postgres` (имя сервиса в docker-compose)
- **Порт:** `5432`
- **Схема:** `public`

### DATABASE_URL
```
postgresql://crm_user:0eb9b983f980d58e7f9798f188f25fbf@postgres:5432/crm_db?schema=public
```

### Docker конфигурация
- **Контейнер БД:** `crm_postgres`
- **Сервис в docker-compose:** `postgres`
- **Том данных:** `flamecrm_postgres_data`
- **Сеть:** `flamecrm_default` (общая для app и postgres)

### Важно
- Хост `postgres` в DATABASE_URL - это имя сервиса в docker-compose, не имя контейнера
- Контейнеры должны быть в одной сети для работы
- Все ссылки на БД в коде используют переменную окружения `DATABASE_URL`

## Файлы конфигурации

### docker-compose.yml
```yaml
services:
  postgres:
    container_name: crm_postgres
    environment:
      POSTGRES_USER: crm_user
      POSTGRES_DB: crm_db
    networks:
      - crm_network

  app:
    environment:
      DATABASE_URL: ${DATABASE_URL}
    networks:
      - crm_network
    depends_on:
      postgres:
        condition: service_healthy

networks:
  crm_network:
    driver: bridge
```

### .env (на сервере)
```env
DATABASE_URL=postgresql://crm_user:0eb9b983f980d58e7f9798f188f25fbf@postgres:5432/crm_db?schema=public
POSTGRES_PASSWORD=0eb9b983f980d58e7f9798f188f25fbf
```

## Проверка работоспособности

```bash
# Проверить статус контейнеров
docker-compose ps

# Проверить подключение к БД
docker exec crm_postgres psql -U crm_user -d crm_db -c "SELECT COUNT(*) FROM \"User\";"

# Проверить health check приложения
curl http://localhost:3000/api/health
```

## Удаленные/неиспользуемые ресурсы

- ❌ Том `ai-crm_postgres_data` - удален (старый, неиспользуемый)
- ✅ Том `flamecrm_postgres_data` - используется (рабочий)

## Примечания

- Все ссылки на БД в коде используют переменную окружения `DATABASE_URL`
- Не нужно хардкодить хост/порт/имя БД в коде
- При изменении конфигурации обновляйте только `.env` и `docker-compose.yml`

