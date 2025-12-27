#!/bin/bash

# Скрипт для проверки пользователей в базе данных

echo "=== Проверка пользователей в базе данных ==="
docker-compose exec -T postgres psql -U crm_user -d crm_db << EOF
SELECT id, email, name, role, "createdAt" 
FROM "User" 
ORDER BY "createdAt" DESC 
LIMIT 10;
EOF

echo ""
echo "=== Проверка конкретного пользователя ==="
docker-compose exec -T postgres psql -U crm_user -d crm_db << EOF
SELECT email, name, role, 
       LENGTH(password) as password_length,
       LEFT(password, 30) as password_preview
FROM "User" 
WHERE email = 'sale2@barier-yug.ru';
EOF

echo ""
echo "=== Общее количество пользователей ==="
docker-compose exec -T postgres psql -U crm_user -d crm_db << EOF
SELECT COUNT(*) as total_users FROM "User";
EOF

