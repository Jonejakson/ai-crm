#!/bin/bash

# Скрипт для ручного применения миграции восстановления пароля

echo "=== Применение миграции для полей восстановления пароля ==="

docker-compose exec -T postgres psql -U crm_user -d crm_db << 'EOF'
-- Проверяем, существуют ли колонки
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'passwordResetToken'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "passwordResetToken" TEXT;
        RAISE NOTICE 'Колонка passwordResetToken добавлена';
    ELSE
        RAISE NOTICE 'Колонка passwordResetToken уже существует';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'passwordResetExpires'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "passwordResetExpires" TIMESTAMP(3);
        RAISE NOTICE 'Колонка passwordResetExpires добавлена';
    ELSE
        RAISE NOTICE 'Колонка passwordResetExpires уже существует';
    END IF;
END $$;
EOF

echo ""
echo "=== Проверка колонок ==="
docker-compose exec -T postgres psql -U crm_user -d crm_db -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'User' AND column_name LIKE '%password%';"

echo ""
echo "=== Миграция завершена ==="

