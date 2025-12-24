# Развертывание страниц Privacy и Terms

## Проблема
Страницы `/privacy` и `/terms` возвращают 404 на сервере.

## Решение

### 1. Пересборка приложения на сервере

После добавления новых страниц необходимо пересобрать приложение:

```bash
# На сервере
cd /opt/flamecrm
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 2. Проверка генерации статических страниц

Next.js должен автоматически сгенерировать статические страницы при сборке. Проверьте логи сборки:

```bash
docker-compose logs app | grep -i "privacy\|terms"
```

### 3. Очистка кэша браузера

После развертывания:
1. Очистите кэш браузера (Ctrl+Shift+Delete)
2. Или откройте в режиме инкогнито
3. Или обновите Service Worker в DevTools (Application → Service Workers → Unregister)

### 4. Проверка файлов на сервере

Убедитесь, что файлы существуют:
```bash
docker-compose exec app ls -la app/privacy/
docker-compose exec app ls -la app/terms/
```

### 5. Если проблема сохраняется

Если страницы все еще не работают:

1. **Проверьте middleware.ts** - убедитесь, что `/privacy` и `/terms` в списке публичных путей
2. **Проверьте layout-client.tsx** - убедитесь, что страницы в списке `publicPaths`
3. **Проверьте Service Worker** - убедитесь, что он не блокирует эти страницы
4. **Проверьте логи Next.js** - могут быть ошибки при генерации страниц

### 6. Альтернативное решение (если не помогает)

Если статическая генерация не работает, можно сделать страницы динамическими:

```typescript
// Убрать эти строки из page.tsx:
// export const dynamic = 'force-static'
// export const revalidate = false
```

Но это не рекомендуется, так как страницы должны быть статическими.

## Проверка после развертывания

1. Откройте `https://ваш-домен.ru/privacy` - должна открыться страница без Sidebar/Header
2. Откройте `https://ваш-домен.ru/terms` - должна открыться страница без Sidebar/Header
3. Проверьте в DevTools (Network) - не должно быть 404 ошибок

