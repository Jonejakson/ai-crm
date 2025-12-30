#!/bin/bash
# Скрипт для переноса данных пользователя sale1@barier-yug.ru на info@flamecrm.ru
# и удаления остальных пользователей

set -e

echo "=== Миграция пользователя на info@flamecrm.ru ==="

# Подключение к БД через docker-compose
DB_CONTAINER="crm_postgres"
DB_USER="crm_user"
DB_NAME="crm_db"

# Проверяем существование старого пользователя
OLD_EMAIL="sale1@barier-yug.ru"
NEW_EMAIL="info@flamecrm.ru"

echo "1. Проверка существования пользователя $OLD_EMAIL..."
OLD_USER_EXISTS=$(docker-compose exec -T postgres psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM \"User\" WHERE email = '$OLD_EMAIL';" | tr -d ' ')

if [ "$OLD_USER_EXISTS" = "0" ]; then
    echo "ОШИБКА: Пользователь $OLD_EMAIL не найден!"
    exit 1
fi

echo "2. Проверка существования пользователя $NEW_EMAIL..."
NEW_USER_EXISTS=$(docker-compose exec -T postgres psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM \"User\" WHERE email = '$NEW_EMAIL';" | tr -d ' ')

if [ "$NEW_USER_EXISTS" != "0" ]; then
    echo "ВНИМАНИЕ: Пользователь $NEW_EMAIL уже существует. Обновляем его..."
    # Обновляем существующего пользователя
    docker-compose exec -T postgres psql -U $DB_USER -d $DB_NAME <<EOF
        -- Получаем данные старого пользователя
        DO \$\$
        DECLARE
            old_user_id INT;
            new_user_id INT;
            old_company_id INT;
        BEGIN
            -- Находим ID старого пользователя
            SELECT id, "companyId" INTO old_user_id, old_company_id 
            FROM "User" 
            WHERE email = '$OLD_EMAIL';
            
            -- Находим или создаем нового пользователя
            SELECT id INTO new_user_id 
            FROM "User" 
            WHERE email = '$NEW_EMAIL';
            
            IF new_user_id IS NULL THEN
                -- Создаем нового пользователя
                INSERT INTO "User" (email, name, password, role, "companyId", "createdAt", "updatedAt")
                SELECT '$NEW_EMAIL', name, password, 'owner', "companyId", NOW(), NOW()
                FROM "User"
                WHERE email = '$OLD_EMAIL'
                RETURNING id INTO new_user_id;
            ELSE
                -- Обновляем существующего
                UPDATE "User"
                SET 
                    name = (SELECT name FROM "User" WHERE email = '$OLD_EMAIL'),
                    password = (SELECT password FROM "User" WHERE email = '$OLD_EMAIL'),
                    role = 'owner',
                    "companyId" = (SELECT "companyId" FROM "User" WHERE email = '$OLD_EMAIL'),
                    "updatedAt" = NOW()
                WHERE id = new_user_id;
            END IF;
            
            -- Переносим все связи
            UPDATE "Contact" SET "userId" = new_user_id WHERE "userId" = old_user_id;
            UPDATE "Deal" SET "userId" = new_user_id WHERE "userId" = old_user_id;
            UPDATE "Task" SET "userId" = new_user_id WHERE "userId" = old_user_id;
            UPDATE "Event" SET "userId" = new_user_id WHERE "userId" = old_user_id;
            UPDATE "File" SET "userId" = new_user_id WHERE "userId" = old_user_id;
            UPDATE "Note" SET "userId" = new_user_id WHERE "userId" = old_user_id;
            
            -- Обновляем компанию, если нужно
            IF old_company_id IS NOT NULL THEN
                UPDATE "Company" SET "ownerId" = new_user_id WHERE id = old_company_id;
            END IF;
            
            RAISE NOTICE 'Пользователь успешно обновлен. ID: %', new_user_id;
        END \$\$;
EOF
else
    echo "3. Создание нового пользователя $NEW_EMAIL..."
    docker-compose exec -T postgres psql -U $DB_USER -d $DB_NAME <<EOF
        -- Создаем нового пользователя с данными старого
        DO \$\$
        DECLARE
            old_user_id INT;
            new_user_id INT;
            old_company_id INT;
        BEGIN
            -- Получаем данные старого пользователя
            SELECT id, "companyId" INTO old_user_id, old_company_id 
            FROM "User" 
            WHERE email = '$OLD_EMAIL';
            
            -- Создаем нового пользователя
            INSERT INTO "User" (email, name, password, role, "companyId", "createdAt", "updatedAt")
            SELECT '$NEW_EMAIL', name, password, 'owner', "companyId", NOW(), NOW()
            FROM "User"
            WHERE email = '$OLD_EMAIL'
            RETURNING id INTO new_user_id;
            
            -- Переносим все связи
            UPDATE "Contact" SET "userId" = new_user_id WHERE "userId" = old_user_id;
            UPDATE "Deal" SET "userId" = new_user_id WHERE "userId" = old_user_id;
            UPDATE "Task" SET "userId" = new_user_id WHERE "userId" = old_user_id;
            UPDATE "Event" SET "userId" = new_user_id WHERE "userId" = old_user_id;
            UPDATE "File" SET "userId" = new_user_id WHERE "userId" = old_user_id;
            UPDATE "Note" SET "userId" = new_user_id WHERE "userId" = old_user_id;
            
            -- Обновляем компанию
            IF old_company_id IS NOT NULL THEN
                UPDATE "Company" SET "ownerId" = new_user_id WHERE id = old_company_id;
            END IF;
            
            RAISE NOTICE 'Пользователь успешно создан. ID: %', new_user_id;
        END \$\$;
EOF
fi

echo "4. Удаление остальных пользователей..."
docker-compose exec -T postgres psql -U $DB_USER -d $DB_NAME <<EOF
    -- Удаляем всех пользователей, кроме info@flamecrm.ru
    DELETE FROM "User" 
    WHERE email != '$NEW_EMAIL' 
    AND email != '$OLD_EMAIL';  -- Пока не удаляем старый, на случай отката
    
    -- Удаляем старый пользователь после успешного переноса
    DELETE FROM "User" WHERE email = '$OLD_EMAIL';
EOF

echo "5. Проверка результата..."
docker-compose exec -T postgres psql -U $DB_USER -d $DB_NAME -c "SELECT id, email, name, role FROM \"User\";"

echo ""
echo "=== Миграция завершена ==="
echo "Новый пользователь: $NEW_EMAIL"
echo "Старый пользователь удален: $OLD_EMAIL"


