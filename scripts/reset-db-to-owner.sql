-- Очистка БД до нуля (кроме _prisma_migrations). Первая компания получит id 221325.
TRUNCATE "Company", "Plan" CASCADE RESTART IDENTITY;
SELECT setval(pg_get_serial_sequence('"Company"', 'id'), 221324);
