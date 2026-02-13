# Деплой на сервер Selectel — выполнить сейчас

## Что исправлено в коде
- Ошибка TypeScript в `app/api/admin/role-permissions/route.ts` (приведение типов для Prisma JSON)
- Добавлен скрипт `scripts/server-deploy.sh` для деплоя на сервере

## Как задеплоить

### Вариант 1: Подключиться по SSH и выполнить вручную

```bash
ssh root@79.143.30.96
cd /opt/flamecrm
git pull origin main
bash scripts/server-deploy.sh
```

Скрипт выполнит: `docker-compose down` → `build --no-cache app` → `up -d` → миграции.

**Сборка занимает ~6–7 минут.** Не прерывайте сессию.

### Вариант 2: Запуск в фоне (если SSH обрывается)

```bash
ssh root@79.143.30.96 "cd /opt/flamecrm && git pull origin main && nohup bash scripts/server-deploy.sh > /tmp/deploy.log 2>&1 &"
```

Проверить прогресс:
```bash
ssh root@79.143.30.96 "tail -f /tmp/deploy.log"
```

Проверить статус контейнеров:
```bash
ssh root@79.143.30.96 "cd /opt/flamecrm && docker-compose ps"
```

### Вариант 3: PowerShell (локально)

```powershell
cd c:\ai-crm\my-app\ai-crm
git push origin main
ssh root@79.143.30.96 "cd /opt/flamecrm && git pull origin main && bash scripts/server-deploy.sh"
```

## Переменные окружения на сервере

В `/opt/flamecrm` должен быть файл `.env`. Скрипт деплоя при наличии `.env` автоматически добавляет в него `NEXTAUTH_URL=https://flamecrm.ru`, если переменная ещё не задана (чтобы ссылки из писем подтверждения вели на сайт, а не на 0.0.0.0).

Остальные переменные (DATABASE_URL, NEXTAUTH_SECRET, MAIL_*, и т.д.) задаются вручную в `.env` на сервере. Шаблон — `.env.example`.

## После деплоя

- Сайт: https://flamecrm.ru
- Health check: https://flamecrm.ru/api/health
- Логи: `docker-compose logs -f app`
