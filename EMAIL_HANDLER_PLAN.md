# План реализации email handler для парсинга ответов

## Что нужно сделать

### 1. Создать API endpoint для обработки входящих писем

**Вариант A: Webhook (если есть email сервис с webhook)**
- Настроить webhook на info@flamecrm.ru
- Создать `/api/support/webhook` для получения писем

**Вариант B: IMAP polling (рекомендуется)**
- Использовать существующую EmailIntegration
- Создать cron job или background worker
- Парсить письма с темой `Re: [TKT-...]`
- Извлекать ticketId из темы или заголовков

### 2. Парсинг email

```typescript
// lib/support/email-parser.ts
export function parseTicketIdFromEmail(email: {
  subject: string
  inReplyTo?: string
  references?: string
  headers?: Record<string, string>
}): string | null {
  // Парсим из темы: Re: [TKT-12345] Тема
  const match = email.subject.match(/\[(TKT-[^\]]+)\]/)
  if (match) {
    return match[1]
  }
  
  // Или из заголовка X-Ticket-ID
  if (email.headers?.['X-Ticket-ID']) {
    return email.headers['X-Ticket-ID']
  }
  
  return null
}
```

### 3. Создать API endpoint для обработки

```typescript
// app/api/support/process-email/route.ts
// Вызывается из IMAP sync или webhook
export async function POST(request: NextRequest) {
  // Получить письмо
  // Парсить ticketId
  // Найти тикет
  // Создать SupportTicketMessage
  // Отправить уведомление пользователю
}
```

### 4. Интеграция с существующим IMAP sync

Обновить `app/api/email-integrations/[id]/sync/route.ts`:
- Проверять тему письма на `Re: [TKT-...]`
- Если найдено - вызывать обработчик тикетов
- Иначе - обычная обработка писем

## Настройка на сервере

1. Создать EmailIntegration для info@flamecrm.ru
2. Настроить IMAP для получения писем
3. Настроить cron job для периодической синхронизации:
   ```bash
   # В crontab
   */5 * * * * curl -X POST http://localhost:3000/api/email-integrations/1/sync
   ```

## Формат email при создании тикета

```
To: info@flamecrm.ru
Subject: [TKT-12345] Тема тикета
X-Ticket-ID: TKT-12345
Reply-To: support+TKT-12345@flamecrm.ru (или использовать X-Ticket-ID)

Новый тикет поддержки TKT-12345

От: sale1@barier-yug.ru
Тема: Тема тикета

Сообщение:
Текст сообщения...

---
Ответьте на это письмо, чтобы добавить ответ в тикет.
Ticket ID: TKT-12345
```

## Формат ответа админа

```
To: support+TKT-12345@flamecrm.ru (или парсим X-Ticket-ID из темы)
Subject: Re: [TKT-12345] Тема тикета
In-Reply-To: <original-message-id>

Ваш ответ...
```

## Следующие шаги

1. ✅ Базовая система тикетов (готово)
2. ⏳ Email handler для парсинга ответов
3. ⏳ Настройка IMAP для info@flamecrm.ru
4. ⏳ Автоматическая синхронизация






