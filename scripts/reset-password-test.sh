#!/bin/bash

# Скрипт для сброса пароля и проверки

echo "=== Сброс пароля через API ==="
curl -X POST http://localhost:3000/api/admin/reset-password-emergency \
  -H 'Content-Type: application/json' \
  -d '{"email":"sale2@barier-yug.ru","newPassword":"password123","key":"emergency-reset-2024"}'

echo ""
echo ""
echo "=== Проверка хеша пароля в БД ==="
docker-compose exec -T postgres psql -U crm_user -d crm_db << EOF
SELECT email, LEFT(password, 30) as password_preview 
FROM "User" 
WHERE email = 'sale2@barier-yug.ru';
EOF

