# Настройка базы данных PostgreSQL

## Быстрая настройка

### Шаг 1: Настройте .env файл

Создайте или обновите файл `.env` в корне проекта:

```env
# Для создания базы данных (используйте базу postgres)
DATABASE_URL="postgresql://postgres:ВАШ_ПАРОЛЬ@localhost:5432/postgres?schema=public"

# NextAuth
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000

# OpenAI API (опционально)
OPENAI_API_KEY=your-openai-api-key-here
```

**Важно:** 
- Замените `ВАШ_ПАРОЛЬ` на пароль, который вы указали при установке PostgreSQL
- Если вы не помните пароль, используйте pgAdmin для его сброса или переустановите PostgreSQL

### Шаг 2: Создайте базу данных

```bash
npm run db:create
```

Скрипт автоматически создаст базу данных `crm_db`.

### Шаг 3: Обновите DATABASE_URL

После создания базы данных обновите `.env`:

```env
DATABASE_URL="postgresql://postgres:ВАШ_ПАРОЛЬ@localhost:5432/crm_db?schema=public"
```

### Шаг 4: Примените миграции

```bash
npm run db:migrate:postgres
```

### Шаг 5: (Опционально) Мигрируйте данные из SQLite

Если у вас есть данные в SQLite:

```bash
node scripts/migrate-to-postgresql.js
```

## Проверка подключения

```bash
npm run db:studio
```

Откроется Prisma Studio, где вы сможете просмотреть данные.

## Решение проблем

### Ошибка: "Неверный формат DATABASE_URL"

Убедитесь, что формат правильный:
```
postgresql://username:password@host:port/database?schema=public
```

### Ошибка: "Connection refused" или "ECONNREFUSED"

1. Убедитесь, что PostgreSQL запущен:
   - Windows: Проверьте службу "postgresql-x64-XX" в "Службы"
   - Или используйте pgAdmin для проверки подключения

2. Проверьте порт (по умолчанию 5432)

3. Проверьте пароль пользователя `postgres`

### Ошибка: "password authentication failed"

1. Проверьте пароль в `.env`
2. Если забыли пароль:
   - Используйте pgAdmin для сброса
   - Или переустановите PostgreSQL

### psql не найден

Используйте альтернативные способы:
- `npm run db:create` (скрипт)
- pgAdmin (графический интерфейс)
- Полный путь: `"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres`




