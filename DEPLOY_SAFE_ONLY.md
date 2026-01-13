# ⚠️ ВСЕГДА ИСПОЛЬЗОВАТЬ ТОЛЬКО ЭТО:

```bash
cd /opt/flamecrm
git pull
./scripts/safe-deploy.sh
```

## ❌ НИКОГДА НЕ ИСПОЛЬЗОВАТЬ:

- `docker-compose down -v` (удаляет БД!)
- `docker-compose build && docker-compose up -d` (может зависнуть)

## ✅ ПРАВИЛО:

**ОДИН ДЕПЛОЙ = ОДИН ЗАПУСК safe-deploy.sh**

Скрипт сам все сделает правильно, включая обработку ошибок!

---

**ПРОДУКТ НА РЕЛИЗЕ - ПОТЕРЯ ДАННЫХ НЕДОПУСТИМА!**


