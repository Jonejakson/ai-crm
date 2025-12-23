#!/bin/bash
# Быстрый скрипт для просмотра пользователей

cd /opt/flamecrm

echo "=== Пользователи в базе данных ==="
echo ""

docker-compose exec -T postgres psql -U crm_user -d crm_db << 'SQL'
SELECT 
    id,
    email,
    name,
    role,
    "companyId"
FROM "User"
ORDER BY id;
SQL

echo ""
echo "Для выхода нажмите Enter"
read


