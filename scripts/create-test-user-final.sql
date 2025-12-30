-- Создание тестового пользователя
-- Копируем пароль от info@flamecrm.ru
INSERT INTO "User" (email, name, password, role, "companyId", "createdAt", "updatedAt")
SELECT 
  'test@flamecrm.ru',
  'Тестовый пользователь',
  password,
  'admin',
  "companyId",
  NOW(),
  NOW()
FROM "User"
WHERE email = 'info@flamecrm.ru'
ON CONFLICT (email) DO UPDATE
SET 
  password = EXCLUDED.password,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  "updatedAt" = NOW();

