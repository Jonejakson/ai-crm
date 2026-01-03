# Исправление проблем с манифестом и входом

## Проблемы
1. Манифест возвращает 404
2. Ошибка входа "Неверный email или пароль"

## Решение

### 1. Исправить манифест

Next.js должен автоматически обслуживать `/manifest` через `app/manifest.ts`, но возможно нужно пересобрать приложение.

**На сервере выполните:**

```bash
cd /opt/flamecrm

# Пересобрать приложение
docker-compose stop app
docker-compose build --no-cache app
docker-compose up -d app

# Подождать 30 секунд и проверить
sleep 30
curl http://127.0.0.1:3000/manifest
```

Если манифест всё ещё не работает, создайте API route:

```bash
# На сервере создать файл app/manifest/route.ts
cat > /opt/flamecrm/app/manifest/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import manifest from '../manifest'

export async function GET() {
  return NextResponse.json(manifest(), {
    headers: {
      'Content-Type': 'application/manifest+json',
    },
  })
}
EOF
```

### 2. Проверить пользователей в базе данных

```bash
cd /opt/flamecrm

# Подключиться к базе данных
docker-compose exec postgres psql -U crm_user -d crm_db

# В psql выполнить:
SELECT email, name, role FROM "User";
\q
```

### 3. Создать пользователя, если его нет

Если пользователей нет, создайте тестового:

```bash
cd /opt/flamecrm

# Создать скрипт для создания пользователя
cat > /tmp/create_user.js << 'EOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'sale1@barier-yug.ru';
  const password = 'your_password_here'; // ЗАМЕНИТЕ НА РЕАЛЬНЫЙ ПАРОЛЬ
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email: email,
      name: 'Test User',
      password: hashedPassword,
      role: 'admin',
      companyId: 1, // Или создайте компанию сначала
    },
  });

  console.log('User created:', user);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
EOF

# Выполнить скрипт в контейнере
docker-compose exec app node /tmp/create_user.js
```

### 4. Альтернатива: использовать публичный манифест

Если Next.js манифест не работает, можно использовать статический файл:

```bash
cd /opt/flamecrm

# Скопировать manifest.json в public
cp public/manifest.json public/manifest.webmanifest

# Или обновить layout.tsx чтобы использовать .webmanifest
```

### 5. Проверка после исправления

```bash
# Проверить манифест
curl http://127.0.0.1:3000/manifest

# Проверить здоровье приложения
curl http://127.0.0.1:3000/api/health

# Перезагрузить Nginx
systemctl reload nginx
```

## Быстрое решение (если нет времени)

1. Использовать статический манифест из `public/manifest.json`
2. Изменить в `app/layout.tsx` строку 90 на:
   ```tsx
   <link rel="manifest" href="/manifest.json" />
   ```
3. Пересобрать и перезапустить приложение






