# Настройка переменных окружения

## Проблема с DATABASE_URL в Next.js/Turbopack

Если Prisma не видит `DATABASE_URL`, убедитесь, что:

1. **Файл `.env` находится в корне проекта** (`C:\ai_crm\my-app\.env`)

2. **Формат DATABASE_URL правильный:**
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/crm_db?schema=public"
   ```
   ⚠️ **Важно:** URL должен быть в кавычках!

3. **Создайте также `.env.local`** (Next.js приоритетно загружает его):
   ```bash
   cp .env .env.local
   ```

4. **Перезапустите dev сервер** после изменения `.env`:
   ```bash
   # Остановите сервер (Ctrl+C)
   npm run dev
   ```

5. **Очистите кеш Next.js** если проблема сохраняется:
   ```bash
   rm -rf .next
   npm run dev
   ```

## Проверка подключения

Запустите тестовый скрипт:
```bash
node scripts/test-prisma-connection.js
```

Если скрипт работает, но приложение нет - проблема в загрузке переменных Next.js.

## Решение для Windows

Если проблема сохраняется, попробуйте:

1. Убедитесь, что `.env` файл сохранен в кодировке UTF-8
2. Проверьте, что нет скрытых символов в DATABASE_URL
3. Перезапустите терминал и dev сервер




