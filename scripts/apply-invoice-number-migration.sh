#!/bin/bash
# Применить миграцию для добавления поля invoiceNumber

docker-compose exec -T postgres psql -U crm_user -d crm_db <<EOF
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");
EOF

echo "Миграция применена успешно"
