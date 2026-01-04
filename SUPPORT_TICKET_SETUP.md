# Настройка системы тикетов поддержки

## Что реализовано

✅ Система тикетов с перепиской
✅ Автоматический парсинг ответов с почты
✅ Админ-панель для owner (`/ops/support`)
✅ Страница для пользователей (`/support`)

## Настройка email интеграции

Для автоматического парсинга ответов нужно настроить IMAP для `info@flamecrm.ru`:

### 1. Создать Email Integration

1. Зайдите в `/company` (раздел "Компания")
2. Перейдите в "Email интеграции"
3. Добавьте новую интеграцию:
   - **Провайдер**: IMAP_SMTP или YANDEX
   - **Email**: `info@flamecrm.ru`
   - **IMAP Host**: (например, `imap.yandex.ru` для Yandex или ваш IMAP сервер)
   - **IMAP Port**: `993` (для SSL) или `143` (без SSL)
   - **IMAP Username**: `info@flamecrm.ru`
   - **IMAP Password**: пароль от почты
   - **Use SSL**: `true` (если порт 993)

### 2. Настроить автоматическую синхронизацию

#### Вариант A: Через cron (рекомендуется)

Добавьте в crontab на сервере:

```bash
# Синхронизация тикетов каждые 5 минут
*/5 * * * * curl -X POST http://localhost:3000/api/support/sync-tickets -H "Cookie: $(cat /tmp/session_cookie)" || true
```

Или используйте существующую синхронизацию email интеграций:

```bash
# Синхронизация email интеграции (будет обрабатывать и тикеты)
*/5 * * * * curl -X POST http://localhost:3000/api/email-integrations/1/sync -H "Cookie: $(cat /tmp/session_cookie)" || true
```

#### Вариант B: Ручная синхронизация

На странице `/ops/support` есть кнопка "Синхронизировать с почтой" - можно запускать вручную.

### 3. Проверка работы

1. Создайте тестовый тикет через `/support`
2. Проверьте, что на `info@flamecrm.ru` пришло письмо с темой `[TKT-...]`
3. Ответьте на письмо (Reply)
4. Запустите синхронизацию (кнопка на `/ops/support` или через cron)
5. Проверьте, что ответ появился в тикете

## Формат email

### При создании тикета

```
To: info@flamecrm.ru
Subject: [TKT-12345] Тема тикета
X-Ticket-ID: TKT-12345
Reply-To: info@flamecrm.ru

Новый тикет поддержки TKT-12345
...
```

### При ответе админа

```
To: support@flamecrm.ru (или email пользователя)
Subject: Re: [TKT-12345] Тема тикета
In-Reply-To: <original-message-id>

Ваш ответ...
```

Система автоматически:
- Найдет ticketId из темы `[TKT-12345]`
- Добавит ответ в переписку тикета
- Обновит статус тикета

## API Endpoints

- `POST /api/support` - создать тикет
- `GET /api/support` - получить тикеты пользователя
- `GET /api/support/tickets` - получить все тикеты (owner)
- `GET /api/support/tickets/[id]` - получить тикет по ID
- `POST /api/support/tickets/[id]` - ответить на тикет
- `PATCH /api/support/tickets/[id]` - изменить статус (owner)
- `POST /api/support/sync-tickets` - синхронизировать ответы с почты (owner)

## Статусы тикетов

- `open` - открыт (ожидает ответа)
- `in_progress` - в работе (админ ответил)
- `resolved` - решен
- `closed` - закрыт

## Примечания

- Ответы парсятся автоматически при синхронизации email интеграции
- Можно отвечать как из системы, так и с почты
- Пользователи видят всю переписку в системе
- Owner видит все тикеты в `/ops/support`







