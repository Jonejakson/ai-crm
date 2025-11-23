# Быстрый старт: Настройка PostgreSQL

## Шаг 1: Создайте файл .env

Создайте файл `.env` в корне проекта (`C:\ai_crm\my-app\.env`) со следующим содержимым:

```env
DATABASE_URL="postgresql://postgres:ВАШ_ПАРОЛЬ@localhost:5432/postgres?schema=public"
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000
OPENAI_API_KEY=your-openai-api-key-here
```

**Важно:**
- Замените `ВАШ_ПАРОЛЬ` на пароль, который вы указали при установке PostgreSQL
- Если вы не помните пароль, используйте pgAdmin для проверки

## Шаг 2: Создайте базу данных

```bash
npm run db:create
```

## Шаг 3: Обновите DATABASE_URL

После успешного создания базы данных, обновите `.env`:

```env
DATABASE_URL="postgresql://postgres:ВАШ_ПАРОЛЬ@localhost:5432/crm_db?schema=public"
```

(Измените `postgres` на `crm_db` в конце URL)

## Шаг 4: Примените миграции

```bash
npm run db:migrate:postgres
```

## Шаг 5: Готово!

Теперь можно запустить приложение:

```bash
npm run dev
```

---

## Если не помните пароль PostgreSQL

1. Откройте **pgAdmin** (установлен вместе с PostgreSQL)
2. Попробуйте подключиться к серверу
3. Если не получается, можно:
   - Сбросить пароль через pgAdmin
   - Или переустановить PostgreSQL с новым паролем

## Альтернатива: Используйте pgAdmin для создания базы данных

1. Откройте pgAdmin
2. Подключитесь к серверу PostgreSQL
3. Правой кнопкой на "Databases" → "Create" → "Database"
4. Имя: `crm_db`
5. Нажмите "Save"
6. Затем сразу переходите к Шагу 3 (обновите DATABASE_URL на `crm_db`)






