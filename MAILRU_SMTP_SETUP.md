# Настройка SMTP для Mail.ru

## Проблема
Mail.ru требует **пароль приложения** (application password) для внешних приложений, а не обычный пароль от почты.

## Решение

### 1. Создать пароль приложения в Mail.ru

1. Войдите в почту Mail.ru: https://mail.ru/
2. Перейдите в **Настройки** → **Безопасность**
3. Найдите раздел **"Пароли приложений"** или **"Внешние приложения"**
4. Создайте новый пароль приложения для SMTP
5. Скопируйте созданный пароль (он будет длинным, например: `AbCdEfGhIjKlMnOpQrStUvWxYz123456`)

### 2. Обновить .env на сервере

Замените `SMTP_PASS` на пароль приложения:

```bash
SMTP_PASS=ваш_пароль_приложения_здесь
```

### 3. Перезапустить контейнер

```bash
docker restart crm_app
```

## Альтернатива: Использовать другой SMTP

Если не хотите использовать Mail.ru, можно настроить другой SMTP провайдер:

### Gmail
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

### Yandex
```env
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_USER=your-email@yandex.ru
SMTP_PASS=your-app-password
SMTP_FROM=your-email@yandex.ru
```

## Проверка

После настройки создайте тестовый тикет и проверьте логи:

```bash
docker logs crm_app | grep -E 'support|email'
```

Должно быть: `[support][email] Email отправлен на info@flamecrm.ru для тикета TKT-...`

