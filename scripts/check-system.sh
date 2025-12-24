#!/bin/bash
# Скрипт для проверки и настройки системы

cd /opt/flamecrm

echo "=== Проверка системы Flame CRM ==="
echo ""

echo "1. Проверка пользователей:"
docker-compose exec -T postgres psql -U crm_user -d crm_db << 'SQL'
SELECT 
    id,
    email,
    name,
    role,
    "companyId",
    CASE WHEN password IS NOT NULL THEN 'Да' ELSE 'Нет' END as has_password,
    "createdAt"
FROM "User"
WHERE email IN ('sale1@barier-yug.ru', 'sale2@barier-yug.ru', 'sale3@barier-yug.ru')
ORDER BY id;
SQL

echo ""
echo "2. Проверка компаний:"
docker-compose exec -T postgres psql -U crm_user -d crm_db << 'SQL'
SELECT 
    id,
    name,
    "isLegalEntity",
    "createdAt"
FROM "Company"
WHERE id IN (2, 11, 12)
ORDER BY id;
SQL

echo ""
echo "3. Проверка подписок:"
docker-compose exec -T postgres psql -U crm_user -d crm_db << 'SQL'
SELECT 
    s.id,
    s."companyId",
    p.slug as plan,
    s.status,
    s."currentPeriodEnd",
    s."trialEndsAt",
    s."cancelAtPeriodEnd"
FROM "Subscription" s
JOIN "Plan" p ON s."planId" = p.id
WHERE s."companyId" IN (2, 11, 12)
ORDER BY s."companyId", s.id DESC;
SQL

echo ""
echo "4. Проверка планов:"
docker-compose exec -T postgres psql -U crm_user -d crm_db << 'SQL'
SELECT id, slug, name, price, "userLimit", "contactLimit"
FROM "Plan"
ORDER BY id;
SQL

echo ""
echo "=== Проверка завершена ==="

