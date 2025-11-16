# Миграция на PostgreSQL

## Шаг 1: Установка PostgreSQL

### Windows
1. Скачайте PostgreSQL с официального сайта: https://www.postgresql.org/download/windows/
2. Установите PostgreSQL, запомните пароль для пользователя `postgres`
3. PostgreSQL будет доступен на порту 5432

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### macOS
```bash
brew install postgresql
brew services start postgresql
```

## Шаг 2: Создание базы данных

### Способ 1: Через скрипт (Рекомендуется)

Убедитесь, что в `.env` указан `DATABASE_URL` с базой данных `postgres`:
```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/postgres?schema=public"
```

Затем запустите:
```bash
npm run db:create
```

Скрипт автоматически создаст базу данных `crm_db`.

### Способ 2: Через psql (если путь добавлен в PATH)

```bash
# Войдите в psql
psql -U postgres

# Создайте базу данных
CREATE DATABASE crm_db;

# Создайте пользователя (опционально)
CREATE USER crm_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE crm_db TO crm_user;

# Выйдите
\q
```

### Способ 3: Через pgAdmin (графический интерфейс)

1. Откройте pgAdmin
2. Подключитесь к серверу PostgreSQL
3. Правой кнопкой на "Databases" → "Create" → "Database"
4. Введите имя: `crm_db`
5. Нажмите "Save"

### Способ 4: Через полный путь к psql (Windows)

Если `psql` не в PATH, используйте полный путь:
```bash
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres
```

(Замените `16` на вашу версию PostgreSQL)

## Шаг 3: Настройка .env файла

Обновите файл `.env`:

```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/crm_db?schema=public"
```

Или если вы создали отдельного пользователя:

```env
DATABASE_URL="postgresql://crm_user:your_password@localhost:5432/crm_db?schema=public"
```

## Шаг 4: Применение миграций

```bash
# Сгенерируйте Prisma Client
npx prisma generate

# Примените миграции
npx prisma migrate dev --name init_postgresql

# Или для продакшена
npx prisma migrate deploy
```

## Шаг 5: Миграция данных из SQLite (если нужно)

Если у вас есть данные в SQLite, используйте скрипт `scripts/migrate-to-postgresql.js`

```bash
node scripts/migrate-to-postgresql.js
```

## Проверка подключения

```bash
# Откройте Prisma Studio
npx prisma studio
```

## Для продакшена (Vercel, Railway, Heroku и т.д.)

1. Создайте PostgreSQL базу данных на вашем хостинге
2. Скопируйте DATABASE_URL из настроек хостинга
3. Добавьте DATABASE_URL в переменные окружения вашего приложения
4. Запустите миграции: `npx prisma migrate deploy`

