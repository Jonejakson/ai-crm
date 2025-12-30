-- Создание тестового пользователя
-- Email: test@flamecrm.ru
-- Пароль: Test123456!
-- Роль: admin

-- Используем хеш пароля от существующего пользователя как шаблон
-- или создаем с временным паролем, который потом можно изменить через интерфейс

-- Вариант 1: Копируем пароль от существующего пользователя (временно)
INSERT INTO "User" (email, name, password, role, "companyId", "createdAt", "updatedAt")
SELECT 
  'test@flamecrm.ru',
  'Тестовый пользователь',
  password, -- Копируем пароль от info@flamecrm.ru
  'admin',
  "companyId",
  NOW(),
  NOW()
FROM "User"
WHERE email = 'info@flamecrm.ru'
ON CONFLICT (email) DO UPDATE
SET 
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  "updatedAt" = NOW();

-- После создания можно изменить пароль через интерфейс или через API

