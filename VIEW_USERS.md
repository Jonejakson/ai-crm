# Как посмотреть пользователей в базе данных

## Способ 1: Через docker-compose exec (быстро)

```bash
cd /opt/flamecrm
docker-compose exec postgres psql -U crm_user -d crm_db -c "SELECT id, email, name, role, \"companyId\" FROM \"User\";"
```

## Способ 2: Интерактивный режим psql (удобнее)

```bash
cd /opt/flamecrm

# Подключиться к базе данных
docker-compose exec postgres psql -U crm_user -d crm_db
```

Затем в psql выполните SQL запросы:

```sql
-- Показать всех пользователей
SELECT id, email, name, role, "companyId" FROM "User";

-- Показать пользователей с информацией о компании
SELECT u.id, u.email, u.name, u.role, c.name as company_name 
FROM "User" u 
LEFT JOIN "Company" c ON u."companyId" = c.id;

-- Подсчитать количество пользователей
SELECT COUNT(*) as total_users FROM "User";

-- Показать пользователей по ролям
SELECT role, COUNT(*) as count FROM "User" GROUP BY role;

-- Выйти из psql
\q
```

## Способ 3: Через Node.js скрипт

```bash
cd /opt/flamecrm

# Создать скрипт
cat > /tmp/list_users.js << 'EOF'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      company: {
        select: {
          name: true
        }
      }
    }
  });

  console.log('\n=== Пользователи в базе данных ===\n');
  
  if (users.length === 0) {
    console.log('❌ Пользователей не найдено');
  } else {
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   Имя: ${user.name || 'не указано'}`);
      console.log(`   Роль: ${user.role}`);
      console.log(`   Компания: ${user.company?.name || 'не указана'}`);
      console.log(`   ID: ${user.id}`);
      console.log('');
    });
    console.log(`Всего пользователей: ${users.length}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
EOF

# Выполнить скрипт
docker-compose exec app node /tmp/list_users.js
```

## Способ 4: Проверить конкретного пользователя

```bash
cd /opt/flamecrm
docker-compose exec postgres psql -U crm_user -d crm_db -c "SELECT * FROM \"User\" WHERE email = 'sale1@barier-yug.ru';"
```

## Полезные команды psql

```sql
-- Показать все таблицы
\dt

-- Показать структуру таблицы User
\d "User"

-- Показать все пользователи с паролями (осторожно!)
SELECT id, email, name, role, password FROM "User";

-- Поиск пользователя по email
SELECT * FROM "User" WHERE email LIKE '%barier%';
```

