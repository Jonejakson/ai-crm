-- Обновление пароля тестового пользователя
-- Этот SQL нужно выполнить после генерации хеша через Node.js
-- Пароль: Test123456!

-- Сначала нужно сгенерировать хеш через:
-- docker-compose exec -T app node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('Test123456!', 10));"
-- Затем вставить полученный хеш в запрос ниже

-- UPDATE "User" 
-- SET password = 'ПОЛУЧЕННЫЙ_ХЕШ',
--     "updatedAt" = NOW()
-- WHERE email = 'test@flamecrm.ru';

