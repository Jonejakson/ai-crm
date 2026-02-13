# Жёсткие правила: сервер и база данных

**Нарушать нельзя. Перед любым действием с БД — читать.**

---

## 1. Одна база — один том

- Используется **только** том `flamecrm_postgres_data` (приложение в `/opt/flamecrm`).
- **Никогда** не поднимать, не копировать и не восстанавливать данные из любых других томов или старых имён (`ai-crm_postgres_data` и т.п.). Старые тома не использовать.

---

## 2. Перед любым рискованным действием — бэкап

Перед тем как:
- делать `restore` / заливать дамп в текущую БД;
- выполнять скрипты, которые делают `DROP` / очистку схемы;
- менять тома или контейнеры postgres;

**обязательно** создать бэкап и убедиться, что он есть:

```bash
ssh root@79.143.30.96 "cd /opt/flamecrm && bash scripts/backup-db.sh"
ls -la /opt/flamecrm/backups/crm_db_backup_*.sql.gz   # на сервере
```

Восстанавливать данные — **только** из этих бэкапов (локальные или из S3), не из «старого тома» или непонятных дампов.

---

## 3. Восстановление — только из бэкапа

Если нужно откатить БД:

1. Взять файл из `/opt/flamecrm/backups/` или из S3 (`s3://flamecrm-files/backups/db/`).
2. Восстановить **только** через скрипт:
   ```bash
   bash scripts/restore-db.sh /opt/flamecrm/backups/crm_db_backup_YYYYMMDD_HHMMSS.sql.gz
   ```
3. **Не** использовать дампы из других томов, старых проектов или «временных» контейнеров.

---

## 4. Деплой — не трогать данные БД

- `scripts/server-deploy.sh` и ручной деплой: только `git pull`, сборка образа приложения, `docker compose up`, миграции.
- **Не** добавлять в деплой шаги: смена тома postgres, восстановление из «старого» дампа, `DROP SCHEMA` / полная очистка БД без явного решения и бэкапа.

---

## 5. Проверка бэкапов

- Cron: каждый день в 2:00 — `scripts/backup-db.sh` (логи: `/opt/flamecrm/backups/backup.log`, `cron.log`).
- Перед каждым деплоем — автоматически вызывается `scripts/backup-db.sh` (см. `scripts/server-deploy.sh`).
- Раз в неделю проверять: `ls -la /opt/flamecrm/backups/` и наличие свежих файлов в S3 (`s3://flamecrm-files/backups/db/`).

---

---

## 6. Если после проблем с БД не получается войти

- **«Неверный email или пароль»** — после восстановления из другого дампа/тома в БД могли оказаться другие пользователи или другие пароли.
- **«Ошибка при обработке запроса» на «Восстановление пароля»** — часто из‑за отсутствия колонок `passwordResetToken`/`passwordResetExpires` в таблице `User` (старый дамп). На сервере выполнить:
  ```bash
  docker compose exec -T postgres psql -U crm_user -d crm_db -c "ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"passwordResetToken\" TEXT; ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"passwordResetExpires\" TIMESTAMP(3);"
  ```
  После этого повторить «Забыли пароль?».
- **Экстренный сброс пароля без почты:** в `.env` на сервере задать `EMERGENCY_PASSWORD_RESET_KEY` (строка ≥32 символов, секретный ключ). Затем:
  ```bash
  curl -X POST https://flamecrm.ru/api/admin/reset-password-emergency \
    -H "Content-Type: application/json" \
    -d '{"email":"USER_EMAIL","newPassword":"NEW_PASSWORD","key":"ВАШ_EMERGENCY_PASSWORD_RESET_KEY"}'
  ```
  После использования ключ лучше сменить или удалить.
- Если пользователя нет в БД — восстанавливать БД **только из своего бэкапа** (см. п. 3).

---

*Если сомневаешься в действии с БД — не делать. Сначала бэкап, потом — только восстановление из этого бэкапа.*
