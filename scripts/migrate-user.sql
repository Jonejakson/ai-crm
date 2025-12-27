-- Миграция пользователя sale1@barier-yug.ru на info@flamecrm.ru
-- и удаление остальных пользователей

BEGIN;

-- 1. Создаем или обновляем пользователя info@flamecrm.ru
DO $$
DECLARE
    old_user_id INT;
    new_user_id INT;
    old_company_id INT;
BEGIN
    -- Находим ID старого пользователя
    SELECT id, "companyId" INTO old_user_id, old_company_id 
    FROM "User" 
    WHERE email = 'sale1@barier-yug.ru';
    
    IF old_user_id IS NULL THEN
        RAISE EXCEPTION 'Пользователь sale1@barier-yug.ru не найден!';
    END IF;
    
    -- Проверяем, существует ли уже info@flamecrm.ru
    SELECT id INTO new_user_id 
    FROM "User" 
    WHERE email = 'info@flamecrm.ru';
    
    IF new_user_id IS NULL THEN
        -- Создаем нового пользователя
        INSERT INTO "User" (email, name, password, role, "companyId", "createdAt", "updatedAt")
        SELECT 'info@flamecrm.ru', name, password, 'owner', "companyId", NOW(), NOW()
        FROM "User"
        WHERE email = 'sale1@barier-yug.ru'
        RETURNING id INTO new_user_id;
        
        RAISE NOTICE 'Создан новый пользователь info@flamecrm.ru с ID: %', new_user_id;
    ELSE
        -- Обновляем существующего
        UPDATE "User"
        SET 
            name = (SELECT name FROM "User" WHERE email = 'sale1@barier-yug.ru'),
            password = (SELECT password FROM "User" WHERE email = 'sale1@barier-yug.ru'),
            role = 'owner',
            "companyId" = (SELECT "companyId" FROM "User" WHERE email = 'sale1@barier-yug.ru'),
            "updatedAt" = NOW()
        WHERE id = new_user_id;
        
        RAISE NOTICE 'Обновлен пользователь info@flamecrm.ru с ID: %', new_user_id;
    END IF;
    
    -- Переносим все связи
    UPDATE "Contact" SET "userId" = new_user_id WHERE "userId" = old_user_id;
    UPDATE "Deal" SET "userId" = new_user_id WHERE "userId" = old_user_id;
    UPDATE "Task" SET "userId" = new_user_id WHERE "userId" = old_user_id;
    UPDATE "Event" SET "userId" = new_user_id WHERE "userId" = old_user_id;
    UPDATE "File" SET "userId" = new_user_id WHERE "userId" = old_user_id;
    UPDATE "Notification" SET "userId" = new_user_id WHERE "userId" = old_user_id;
    
    -- Компания связана через companyId в User, не нужно обновлять
    
    RAISE NOTICE 'Все связи перенесены на пользователя с ID: %', new_user_id;
END $$;

-- 2. Удаляем всех пользователей, кроме info@flamecrm.ru
DELETE FROM "User" 
WHERE email != 'info@flamecrm.ru';

-- 3. Проверяем результат
SELECT id, email, name, role FROM "User";

COMMIT;

