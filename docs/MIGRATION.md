# Миграция с SQLite на PostgreSQL

Это руководство поможет вам мигрировать данные из SQLite в PostgreSQL.

## Предварительные требования

1. Установленный PostgreSQL (локально или облачный сервис)
2. Созданная база данных PostgreSQL
3. Настроенная переменная окружения `DATABASE_URL`

## Шаги миграции

### 1. Обновление Prisma Schema

Убедитесь, что `prisma/schema.prisma` использует PostgreSQL:

```prisma
datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
}
```

### 2. Создание новой базы данных PostgreSQL

```bash
# Локально
createdb crm_db

# Или через psql
psql -U postgres
CREATE DATABASE crm_db;
```

### 3. Настройка DATABASE_URL

В файле `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/crm_db?schema=public"
```

### 4. Применение миграций

```bash
# Создание и применение миграций
npx prisma migrate dev --name init

# Генерация Prisma Client
npx prisma generate
```

### 5. Миграция данных (опционально)

Если у вас есть данные в SQLite, которые нужно перенести:

#### Вариант 1: Использование Prisma Studio

1. Экспортируйте данные из SQLite через Prisma Studio:
   ```bash
   # Временно измените schema на SQLite
   npx prisma studio
   ```

2. Импортируйте данные в PostgreSQL через Prisma Studio с новой конфигурацией

#### Вариант 2: SQL скрипт

Создайте скрипт для экспорта/импорта данных (требует ручной работы с SQL).

#### Вариант 3: Использование утилит миграции

Используйте специализированные инструменты для миграции данных между базами.

## Проверка миграции

После миграции проверьте:

1. **Подключение к базе:**
   ```bash
   npx prisma db pull
   ```

2. **Просмотр данных:**
   ```bash
   npx prisma studio
   ```

3. **Запуск приложения:**
   ```bash
   npm run dev
   ```

## Облачные сервисы PostgreSQL

### Supabase
1. Создайте проект на [supabase.com](https://supabase.com)
2. Скопируйте Connection String из настроек проекта
3. Используйте его как `DATABASE_URL`

### Neon
1. Создайте проект на [neon.tech](https://neon.tech)
2. Скопируйте Connection String
3. Используйте его как `DATABASE_URL`

### Railway
1. Создайте проект на [railway.app](https://railway.app)
2. Добавьте PostgreSQL сервис
3. Скопируйте Connection String из переменных окружения

### Heroku
1. Создайте приложение на [heroku.com](https://heroku.com)
2. Добавьте PostgreSQL addon
3. Используйте `heroku config:get DATABASE_URL`

## Решение проблем

### Ошибка подключения
- Проверьте правильность `DATABASE_URL`
- Убедитесь, что PostgreSQL запущен
- Проверьте права доступа пользователя

### Ошибки миграции
- Убедитесь, что база данных пуста или используйте `--create-only`
- Проверьте совместимость версий Prisma

### Проблемы с типами данных
- PostgreSQL более строгий к типам, чем SQLite
- Проверьте все поля на соответствие типам в schema

## Откат на SQLite (для разработки)

Если нужно вернуться к SQLite для разработки:

1. Измените `prisma/schema.prisma`:
   ```prisma
   datasource db {
       provider = "sqlite"
       url      = "file:./dev.db"
   }
   ```

2. Выполните:
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

