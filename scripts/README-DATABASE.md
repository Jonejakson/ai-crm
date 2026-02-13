# База данных на сервере

## Один том PostgreSQL

Используется только том **flamecrm_postgres_data**. Он создаётся и используется при `cd /opt/flamecrm && docker compose up`.

Старый том `ai-crm_postgres_data` удалён, чтобы не было путаницы.

## Проверить БД

```bash
ssh root@79.143.30.96
cd /opt/flamecrm
docker volume ls | grep postgres
bash scripts/check-db-on-server.sh   # статистика: User, Company, Deal, Contact
```

## Важно

- `docker compose down` **не** удаляет том (данные остаются).
- `docker compose down -v` **удаляет** том — не используйте, если не хотите потерять данные.
- Регулярно делайте бэкапы: `docker compose exec postgres pg_dump -U crm_user crm_db > backup_$(date +%Y%m%d).sql`
