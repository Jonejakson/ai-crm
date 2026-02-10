# Инструкция для агента: выгрузка на сервер

**Когда пользователь пишет «выгружай на сервер» — выполнять ТОЛЬКО это.**

---

## 1. Деплой (основная команда)

```bash
ssh selectel "cd /opt/flamecrm && git pull origin main && bash scripts/safe-deploy.sh"
```

(Если на сервере `Permission denied` для `./scripts/safe-deploy.sh` — использовать `bash scripts/safe-deploy.sh`.)

- **Таймаут:** 10+ минут (сборка Docker ~8–12 мин)
- **Запуск:** только в foreground, НИКОГДА в фоне
- **Хост:** `selectel` (алиас в `~/.ssh/config`, ключ `id_ed25519_selectel`)

---

## 2. Если деплой падает с ошибками

### Ошибка: `ContainerConfig`, `unhealthy`, `Encountered errors while bringing up`

```bash
ssh selectel "cd /opt/flamecrm && docker-compose down && docker container prune -f && docker-compose up -d"
```

Затем применить миграции:

```bash
ssh selectel "cd /opt/flamecrm && docker-compose exec -T app npx prisma@6.19.0 migrate deploy"
```

---

## 3. Запрещено

- `docker-compose down -v` — удаляет БД
- Запуск деплоя в фоне
- Использовать `ssh root@79.143.30.96` без ключа (будет запрос пароля)
- Писать пользователю «выполни вручную» — сначала выполнить самому

---

## 4. Проверка после деплоя

```bash
ssh selectel "cd /opt/flamecrm && docker-compose ps"
```

Ожидаемо: `crm_app` и `crm_postgres` в состоянии `Up`.

---

## 5. Если 502 Bad Gateway

Приложение не отвечает. Проверить:

```bash
ssh selectel "cd /opt/flamecrm && docker-compose ps -a && docker-compose logs app --tail 50"
```

Если контейнеры не запущены — выполнить шаг 2.
