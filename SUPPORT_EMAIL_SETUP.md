# Настройка системной почты поддержки

## Что изменилось

Теперь `info@flamecrm.ru` - это **системная почта поддержки**, которая используется везде автоматически. Не нужно настраивать email интеграцию вручную.

## Варианты настройки

### Вариант 1: Через переменные окружения (рекомендуется)

Добавьте в `.env` на сервере:

```bash
# Системная почта поддержки (уже используется везде)
SUPPORT_EMAIL=info@flamecrm.ru

# Настройки IMAP для синхронизации ответов
SUPPORT_IMAP_HOST=imap.yandex.ru  # или ваш IMAP сервер
SUPPORT_IMAP_PORT=993
SUPPORT_IMAP_USER=info@flamecrm.ru
SUPPORT_IMAP_PASSWORD=ваш_пароль
SUPPORT_IMAP_SSL=true
```

**Преимущества:**
- Не нужно настраивать через интерфейс
- Работает автоматически
- Безопасно (пароли в .env)

### Вариант 2: Через Email интеграции (если нужна гибкость)

1. Зайдите в `/company` → "Email интеграции"
2. Добавьте интеграцию для `info@flamecrm.ru`
3. Система автоматически использует её для синхронизации

**Преимущества:**
- Можно настроить через интерфейс
- Можно использовать разные провайдеры (Gmail, Outlook, Yandex)

### Вариант 3: Автоматически из SMTP настроек

Если у вас уже настроены SMTP настройки (`MAIL_HOST`, `MAIL_USER`, `MAIL_PASSWORD`), система попытается использовать их для IMAP:

- `MAIL_HOST` → `imap.{host}` (автоматически)
- `MAIL_USER` → используется как `SUPPORT_IMAP_USER`
- `MAIL_PASSWORD` → используется как `SUPPORT_IMAP_PASSWORD`

**Примечание:** Работает не всегда, зависит от провайдера. Лучше использовать Вариант 1.

## Как это работает

1. **Создание тикета** → письмо отправляется на `info@flamecrm.ru`
2. **Ответ админа** → можно отвечать с почты или из системы
3. **Синхронизация** → система проверяет почту и добавляет ответы в тикеты

## Проверка настройки

На странице `/ops/support` есть кнопка "Синхронизировать с почтой". Если настройка правильная:
- ✅ Кнопка работает
- ✅ Ответы с почты появляются в тикетах

Если ошибка:
- ❌ Проверьте переменные окружения
- ❌ Проверьте настройки IMAP
- ❌ Убедитесь, что пароль правильный

## Примеры для разных провайдеров

### Yandex
```bash
SUPPORT_IMAP_HOST=imap.yandex.ru
SUPPORT_IMAP_PORT=993
SUPPORT_IMAP_USER=info@flamecrm.ru
SUPPORT_IMAP_PASSWORD=пароль_от_почты
SUPPORT_IMAP_SSL=true
```

### Gmail (через IMAP)
```bash
SUPPORT_IMAP_HOST=imap.gmail.com
SUPPORT_IMAP_PORT=993
SUPPORT_IMAP_USER=info@flamecrm.ru
SUPPORT_IMAP_PASSWORD=app_password  # Нужен App Password, не обычный пароль
SUPPORT_IMAP_SSL=true
```

### Mail.ru
```bash
SUPPORT_IMAP_HOST=imap.mail.ru
SUPPORT_IMAP_PORT=993
SUPPORT_IMAP_USER=info@flamecrm.ru
SUPPORT_IMAP_PASSWORD=пароль_от_почты
SUPPORT_IMAP_SSL=true
```

## Автоматическая синхронизация

Добавьте в crontab на сервере:

```bash
# Синхронизация тикетов каждые 5 минут
*/5 * * * * curl -X POST http://localhost:3000/api/support/sync-tickets -H "Authorization: Bearer $(cat /tmp/token)" || true
```

Или используйте существующую синхронизацию email интеграций (если настроена).

## Важно

- `info@flamecrm.ru` теперь используется **везде** в системе автоматически
- Не нужно указывать email вручную при создании тикетов
- Система сама знает, куда отправлять письма
- Ответы автоматически парсятся и добавляются в тикеты













