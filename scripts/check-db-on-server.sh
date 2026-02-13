#!/bin/bash
# Проверка: какая база и какой том используется на сервере.
# Запуск: ssh root@79.143.30.96 "cd /opt/flamecrm && bash scripts/check-db-on-server.sh"

set -e
cd /opt/flamecrm

echo "=== Тома Docker (postgres) ==="
docker volume ls --format "table {{.Name}}\t{{.Driver}}" | grep -E "postgres_data|NAME" || true

echo ""
echo "=== Какой том привязан к контейнеру postgres ==="
docker inspect crm_postgres --format '{{range .Mounts}}{{.Name}} -> {{.Destination}}{{"\n"}}{{end}}' 2>/dev/null || echo "Контейнер crm_postgres не запущен"

echo ""
echo "=== Статистика текущей БД (подключение из .env) ==="
docker compose exec -T postgres psql -U crm_user -d crm_db -t -c "
  SELECT 'User: ' || COUNT(*) FROM \"User\"
  UNION ALL
  SELECT 'Company: ' || COUNT(*) FROM \"Company\"
  UNION ALL
  SELECT 'Contact: ' || COUNT(*) FROM \"Contact\"
  UNION ALL
  SELECT 'Deal: ' || COUNT(*) FROM \"Deal\";
" 2>/dev/null || echo "Не удалось выполнить запрос (контейнер не запущен или нет прав)"

echo ""
echo "=== Готово ==="
