#!/bin/bash
# Применить миграцию для добавления полей в таблицу Invoice

docker-compose exec -T postgres psql -U crm_user -d crm_db <<EOF
-- Создать enum PayerType, если его нет
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PayerType') THEN
        CREATE TYPE "PayerType" AS ENUM ('INDIVIDUAL', 'LEGAL');
    END IF;
END\$\$;

-- Добавить поля
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paymentPeriodMonths" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "companyId" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "payerType" "PayerType" NOT NULL DEFAULT 'INDIVIDUAL';

-- Создать индексы
CREATE INDEX IF NOT EXISTS "Invoice_companyId_idx" ON "Invoice"("companyId");

-- Добавить внешний ключ, если его нет
DO \$\$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Invoice_companyId_fkey'
    ) THEN
        ALTER TABLE "Invoice" 
        ADD CONSTRAINT "Invoice_companyId_fkey" 
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL;
    END IF;
END \$\$;
EOF

echo "Миграция полей Invoice применена успешно"
