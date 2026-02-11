# Пересборка проекта на сервере (flamecrm.ru)

Используйте эту инструкцию, если на продакшене «что-то не так»: не входит логин, старый интерфейс, ошибки после обновления кода.

## 1. Подключение к серверу

```bash
ssh root@79.143.30.96
```

Путь к проекту может быть:
- `/opt/flamecrm` (если деплой через server-deploy.sh)
- `/opt/ai-crm/my-app` (по DEPLOY_SERVER_STEPS.md)

Проверьте, где лежит проект:
```bash
ls -la /opt/flamecrm 2>/dev/null || ls -la /opt/ai-crm/my-app 2>/dev/null
```

Дальше в командах подставьте свой путь, например `cd /opt/flamecrm` или `cd /opt/ai-crm/my-app`.

## 2. Проверка .env на сервере

**Критично для входа:** если `NEXTAUTH_URL` или `AUTH_SECRET` не совпадают с тем, что ожидает приложение, сессии и логин могут ломаться.

```bash
cd /opt/flamecrm   # или /opt/ai-crm/my-app
cat .env | grep -E "NEXTAUTH_URL|AUTH_SECRET|DATABASE_URL"
```

Должно быть:
- **NEXTAUTH_URL** — именно `https://flamecrm.ru` (без слэша в конце), не `http://localhost:3000`
- **AUTH_SECRET** — не пустой, один и тот же на всех рестартах
- **DATABASE_URL** — строка подключения к PostgreSQL (логин/пароль/хост/база соответствуют контейнеру postgres или внешней БД)

Если что-то не так — отредактируйте:
```bash
nano .env
```

## 3. Полная пересборка и перезапуск

```bash
cd /opt/flamecrm   # или ваш путь
git pull origin main
docker-compose down
docker-compose build --no-cache app
docker-compose up -d
```

Подождите 15–20 секунд, затем примените миграции:

```bash
docker-compose exec -T app npx prisma migrate deploy
docker-compose exec -T app npx prisma generate
```

Проверка:
```bash
docker-compose ps
docker-compose logs -f app
```

В логах не должно быть ошибок подключения к БД или к NextAuth. Выход из логов: `Ctrl+C`.

## 4. Если «Неверный email или пароль» остаётся

Ошибка приходит с сервера: пользователь не найден в БД или пароль не совпадает.

1. **Проверить, что пользователь есть в продакшен-БД:**

   ```bash
   docker-compose exec -T app node -e "
   require('dotenv').config();
   const { PrismaClient } = require('@prisma/client');
   const prisma = new PrismaClient();
   prisma.user.findMany({ select: { id: true, email: true } }).then(console.log).finally(() => prisma.\$disconnect());
   "
   ```

   Убедитесь, что в списке есть нужный email (например `sale1@barier-yug.ru`).

2. **Сбросить пароль пользователю** (если нужно) — через скрипт сброса пароля или через Prisma Studio:
   ```bash
   docker-compose exec -T app npx prisma studio
   ```
   Откроется веб-интерфейс к БД (по указанному в выводе адресу). Пароль в БД хранится в виде bcrypt-хеша; при необходимости создайте нового пользователя через регистрацию на сайте или скрипт.

3. **Проверить переменные в контейнере:**
   ```bash
   docker-compose exec -T app printenv | grep -E "NEXTAUTH_URL|AUTH_SECRET|DATABASE_URL"
   ```

## 5. Со стороны пользователя (браузер)

После пересборки на сервере у пользователя может оставаться старый кэш и старый Service Worker.

Рекомендуйте:
- **Жёсткое обновление:** `Ctrl+Shift+R` (или `Cmd+Shift+R` на Mac).
- Либо: DevTools → Application → Storage → **Clear site data** для `flamecrm.ru`.
- Либо: Application → Service Workers → **Unregister** для этого сайта, затем обновить страницу.

После этого запросы пойдут на свежий сервер и новый кэш.

## 6. Краткая шпаргалка (одной командой)

Если путь к проекту на сервере — `/opt/flamecrm`:

```bash
ssh root@79.143.30.96 "cd /opt/flamecrm && git pull origin main && docker-compose down && docker-compose build --no-cache app && docker-compose up -d && sleep 15 && docker-compose exec -T app npx prisma migrate deploy && docker-compose ps"
```

Либо зайти по SSH и выполнить шаги из раздела 3 по очереди.
