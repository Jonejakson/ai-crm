# Сброс БД до одного кабинета владельца

**Скрипт:** `scripts/reset-db-to-owner.js`

Очищает всю БД (кроме миграций), выставляет sequence для `Company` так, что первая компания получит **id = 221325**, создаёт тарифы (Plan), одну компанию «Flame CRM» и одного пользователя **info@flamecrm.ru** (пароль задаётся в скрипте) — кабинет владельца с операциями и подписками.

**Перед запуском — обязательно сделать бэкап:**

```bash
ssh root@79.143.30.96 "cd /opt/flamecrm && bash scripts/backup-db.sh"
```

**Запуск на сервере:**

```bash
ssh root@79.143.30.96 "cd /opt/flamecrm && docker compose exec -T app node scripts/reset-db-to-owner.js"
```

Владелец определяется по email в `lib/owner.ts` (info@flamecrm.ru уже в списке по умолчанию).
