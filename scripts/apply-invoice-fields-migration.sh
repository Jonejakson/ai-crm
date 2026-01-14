#!/bin/bash
# Применить миграцию для добавления полей в таблицу Invoice

docker-compose exec -T postgres psql -U crm_user -d crm_db <<EOF
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paymentPeriodMonths" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "companyId" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "payerType" "PayerType" NOT NULL DEFAULT 'INDIVIDUAL';
CREATE INDEX IF NOT EXISTS "Invoice_companyId_idx" ON "Invoice"("companyId");
EOF

echo "Миграция полей Invoice применена успешно"
