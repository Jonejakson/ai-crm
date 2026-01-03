# Быстрое исправление проблем

## Проблемы
1. Манифест возвращает 404
2. Ошибка входа "Неверный email или пароль"

## Решение (выполнить на сервере)

```bash
cd /opt/flamecrm

# 1. Обновить код
git pull origin main

# 2. Перезапустить приложение
docker-compose restart app

# 3. Подождать 30 секунд
sleep 30

# 4. Проверить манифест
curl http://127.0.0.1:3000/manifest.json

# 5. Проверить пользователей в базе
docker-compose exec postgres psql -U crm_user -d crm_db -c "SELECT email, name, role FROM \"User\";"

# 6. Если пользователей нет, нужно создать
# См. инструкцию в FIX_MANIFEST_AND_LOGIN.md

# 7. Перезагрузить Nginx
systemctl reload nginx
```

## Если манифест всё ещё не работает

Проверьте, что файл существует:
```bash
ls -la /opt/flamecrm/public/manifest.json
```

Если файла нет, скопируйте его:
```bash
cd /opt/flamecrm
cat > public/manifest.json << 'EOF'
{
  "name": "Flame CRM - Управление клиентами и сделками",
  "short_name": "Flame CRM",
  "description": "Flame CRM — современная система для управления клиентами, сделками, задачами и аналитикой",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#3f6ff5",
  "orientation": "portrait-primary",
  "scope": "/",
  "icons": [
    {
      "src": "/icon.svg",
      "sizes": "512x512",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ],
  "categories": ["business", "productivity"],
  "shortcuts": [
    {
      "name": "Контакты",
      "short_name": "Контакты",
      "description": "Быстрый доступ к контактам",
      "url": "/contacts",
      "icons": [{ "src": "/icon.svg", "sizes": "512x512" }]
    },
    {
      "name": "Сделки",
      "short_name": "Сделки",
      "description": "Быстрый доступ к сделкам",
      "url": "/deals",
      "icons": [{ "src": "/icon.svg", "sizes": "512x512" }]
    },
    {
      "name": "Задачи",
      "short_name": "Задачи",
      "description": "Быстрый доступ к задачам",
      "url": "/tasks",
      "icons": [{ "src": "/icon.svg", "sizes": "512x512" }]
    }
  ]
}
EOF
```

## Очистка кэша браузера

После исправления на сервере:
1. Откройте DevTools (F12)
2. Правый клик на кнопке обновления
3. Выберите "Очистить кэш и жесткая перезагрузка"

Или в консоли браузера:
```javascript
// Очистить кэш service worker
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
});
location.reload(true);
```






