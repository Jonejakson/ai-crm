-- Создание тестового пользователя
-- Пароль: Test123456!
-- Хеш пароля будет сгенерирован через Node.js

-- Сначала получаем хеш пароля (выполнить отдельно):
-- docker-compose exec -T app node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('Test123456!', 10));"

-- Затем вставить полученный хеш в запрос ниже

-- Пример запроса (замените PASSWORD_HASH на реальный хеш):
-- INSERT INTO "User" (email, name, password, role, "companyId", "createdAt", "updatedAt")
-- VALUES (
--   'test@flamecrm.ru',
--   'Тестовый пользователь',
--   'PASSWORD_HASH',
--   'admin',
--   (SELECT id FROM "Company" LIMIT 1),
--   NOW(),
--   NOW()
-- )
-- ON CONFLICT (email) DO UPDATE
-- SET password = EXCLUDED.password,
--     name = EXCLUDED.name,
--     role = EXCLUDED.role,
--     "updatedAt" = NOW();

