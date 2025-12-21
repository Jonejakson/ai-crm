# Создание пользователя в базе данных

## Проблема
После восстановления базы данных пользователи могли быть потеряны. Нужно создать пользователя для входа.

## Решение

### Вариант 1: Через psql (быстро)

```bash
cd /opt/flamecrm

# Подключиться к базе данных
docker-compose exec postgres psql -U crm_user -d crm_db
```

В psql выполните:

```sql
-- Проверить существующих пользователей
SELECT id, email, name, role FROM "User";

-- Если пользователей нет, создать компанию и пользователя
-- Сначала создайте компанию (если нужно)
INSERT INTO "Company" (name, "createdAt", "updatedAt")
VALUES ('Test Company', NOW(), NOW())
RETURNING id;

-- Запомните ID компании, затем создайте пользователя
-- Пароль будет захеширован через bcrypt
-- Для пароля "password123" хеш: $2a$10$rOzJqZqZqZqZqZqZqZqZqO
-- Но лучше использовать скрипт ниже
```

### Вариант 2: Через Node.js скрипт (рекомендуется)

```bash
cd /opt/flamecrm

# Создать скрипт
cat > /tmp/create_user.js << 'EOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'sale1@barier-yug.ru';
  const password = 'your_password_here'; // ЗАМЕНИТЕ НА РЕАЛЬНЫЙ ПАРОЛЬ
  const hashedPassword = await bcrypt.hash(password, 10);

  // Проверить, существует ли пользователь
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    console.log('Пользователь уже существует:', existingUser.email);
    return;
  }

  // Создать или найти компанию
  let company = await prisma.company.findFirst({
    where: { name: 'Test Company' }
  });

  if (!company) {
    company = await prisma.company.create({
      data: { name: 'Test Company' }
    });
    console.log('Создана компания:', company.id);
  }

  // Создать пользователя
  const user = await prisma.user.create({
    data: {
      email: email,
      name: 'Test User',
      password: hashedPassword,
      role: 'admin',
      companyId: company.id,
    },
  });

  console.log('✅ Пользователь создан:', user.email, 'ID:', user.id);
  console.log('Пароль:', password);
}

main()
  .catch((e) => {
    console.error('Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
EOF

# Выполнить скрипт
docker-compose exec app node /tmp/create_user.js
```

### Вариант 3: Использовать API регистрации

Если API регистрации работает, можно зарегистрироваться через форму на сайте.

## Проверка

После создания пользователя проверьте:

```bash
docker-compose exec postgres psql -U crm_user -d crm_db -c "SELECT email, name, role FROM \"User\";"
```

## Важно

- Замените `your_password_here` на реальный пароль
- Пароль должен быть минимум 6 символов
- После создания пользователя попробуйте войти через форму

