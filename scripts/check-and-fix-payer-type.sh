#!/bin/bash
# Проверить и добавить поле payerType, если его нет

docker-compose exec -T postgres psql -U crm_user -d crm_db <<EOF
-- Создать enum PayerType, если его нет
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PayerType') THEN
        CREATE TYPE "PayerType" AS ENUM ('INDIVIDUAL', 'LEGAL');
    END IF;
END\$\$;

-- Проверить и добавить поле payerType
DO \$\$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Invoice' AND column_name = 'payerType'
    ) THEN
        ALTER TABLE "Invoice" ADD COLUMN "payerType" "PayerType" NOT NULL DEFAULT 'INDIVIDUAL';
        RAISE NOTICE 'Поле payerType добавлено';
    ELSE
        RAISE NOTICE 'Поле payerType уже существует';
    END IF;
END\$\$;
EOF

echo "Проверка завершена"
