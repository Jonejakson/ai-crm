# Безопасность Webhook'ов

## Валидация подписей HMAC-SHA256

Все webhook'и в системе поддерживают валидацию подписей с использованием HMAC-SHA256 для защиты от несанкционированных запросов.

### Реализованные интеграции

#### 1. YooKassa
- **Заголовок**: `X-YooMoney-Signature`
- **Формат**: `sha256=<signature>`
- **Функция**: `verifyYooKassaWebhook()` в `lib/payment.ts`
- **Использование**: Автоматически проверяется в `app/api/billing/webhook/route.ts`

#### 2. Yandex.Direct
- **Заголовок**: `X-Yandex-Signature`
- **Формат**: Простой hex (без префикса)
- **Функция**: `verifyYandexDirectWebhookSignature()` в `lib/webhook-security.ts`
- **Использование**: Проверяется в `app/api/advertising/yandex-direct/webhook/route.ts`

#### 3. Avito
- **Заголовок**: `X-Avito-Signature`
- **Формат**: Простой hex (без префикса)
- **Функция**: `verifyAvitoWebhookSignature()` в `lib/webhook-security.ts`
- **Использование**: Проверяется в `app/api/advertising/avito/webhook/route.ts`

#### 4. WhatsApp Business API
- **Заголовок**: `X-Hub-Signature-256`
- **Формат**: `sha256=<signature>`
- **Функция**: `verifyWhatsAppWebhookSignature()` в `lib/webhook-security.ts`
- **Использование**: Проверяется в `app/api/messaging/whatsapp/webhook/route.ts` (POST метод)

#### 5. Generic Webhooks
- **Заголовки**: `X-Signature`, `X-Hub-Signature-256`, `X-Webhook-Signature`
- **Формат**: Настраивается в `settings.signatureFormat` (по умолчанию `plain`)
- **Функция**: `verifyWebhookSignature()` в `lib/webhook-security.ts`
- **Использование**: Проверяется в `app/api/webhooks/incoming/[token]/route.ts`

### Универсальная утилита

Файл `lib/webhook-security.ts` содержит универсальную функцию `verifyWebhookSignature()`, которая:

1. **Поддерживает разные форматы заголовков**:
   - `plain` - простая hex подпись
   - `sha256=prefix` - формат `sha256=abc123...`
   - `custom` - кастомный префикс

2. **Использует timing-safe сравнение**:
   - Защита от timing attacks через `crypto.timingSafeEqual()`
   - Предотвращает утечку информации о подписи через время ответа

3. **Поддерживает зашифрованные секреты**:
   - Автоматически расшифровывает секреты, если они зашифрованы
   - Использует функцию `decrypt()` из `lib/encryption.ts`

### Пример использования

```typescript
import { verifyWebhookSignature } from '@/lib/webhook-security'

// Получаем тело запроса как строку
const bodyText = await request.text()
const signature = request.headers.get('x-signature')
const secret = integration.webhookSecret // Зашифрованный секрет

// Проверяем подпись
const isValid = await verifyWebhookSignature(
  bodyText,
  signature,
  secret,
  {
    headerFormat: 'plain', // или 'sha256=prefix', 'custom'
    isEncrypted: true, // секрет зашифрован
  }
)

if (!isValid) {
  return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
}
```

### Безопасность

1. **Все секреты хранятся в зашифрованном виде** в базе данных
2. **Используется timing-safe сравнение** для предотвращения timing attacks
3. **Проверка подписи обязательна** для всех webhook'ов в production
4. **Логирование ошибок** для мониторинга попыток несанкционированного доступа

### Настройка

Для каждой интеграции можно настроить `webhookSecret` в настройках компании. Секрет автоматически шифруется при сохранении и расшифровывается при проверке подписи.

### Тестирование

Для тестирования webhook'ов в development можно временно отключить проверку подписи, но в production это **обязательно** должно быть включено.

