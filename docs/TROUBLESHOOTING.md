# Решение проблем с PostgreSQL

## Ошибка: "Authentication failed"

### Причина 1: Неверный пароль

**Решение:**
1. Откройте **pgAdmin**
2. Попробуйте подключиться к серверу PostgreSQL
3. Если не получается, пароль неверный

**Как сбросить/проверить пароль:**
- Используйте pgAdmin для изменения пароля
- Или переустановите PostgreSQL с новым паролем

### Причина 2: PostgreSQL не запущен

**Решение:**
1. Откройте "Службы" (Services) в Windows
2. Найдите службу PostgreSQL (например, "postgresql-x64-16")
3. Убедитесь, что статус "Выполняется" (Running)
4. Если нет - запустите службу

**Через PowerShell:**
```powershell
Get-Service -Name "*postgresql*"
Start-Service -Name "postgresql-x64-16"  # Замените на вашу версию
```

### Причина 3: Пользователь postgres не существует

**Решение:**
Создайте базу данных через pgAdmin (см. ниже)

## Альтернативный способ: Создание базы данных через pgAdmin

### Шаг 1: Откройте pgAdmin

1. Найдите pgAdmin в меню "Пуск"
2. Запустите приложение
3. Введите мастер-пароль (если запрашивается)

### Шаг 2: Подключитесь к серверу

1. В левой панели найдите "Servers"
2. Разверните сервер PostgreSQL
3. Если сервер не добавлен:
   - Правой кнопкой на "Servers" → "Create" → "Server"
   - General → Name: `PostgreSQL`
   - Connection:
     - Host: `localhost`
     - Port: `5432`
     - Username: `postgres`
     - Password: ваш пароль
   - Нажмите "Save"

### Шаг 3: Создайте базу данных

1. Правой кнопкой на "Databases" → "Create" → "Database"
2. Database: `crm_db`
3. Owner: `postgres`
4. Нажмите "Save"

### Шаг 4: Обновите .env

```env
DATABASE_URL="postgresql://postgres:vergynia1997@localhost:5432/crm_db?schema=public"
```

### Шаг 5: Примените миграции

```bash
npm run db:migrate:postgres
```

## Проверка подключения

После создания базы данных проверьте подключение:

```bash
npm run db:studio
```

Если Prisma Studio открывается - подключение работает!



