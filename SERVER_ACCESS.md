# Подключение к серверу Selectel

## SSH подключение

### Вариант 1: С указанием ключа (Windows PowerShell)
```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_selectel" root@79.143.30.96
```

### Вариант 2: Если не работает, попробуйте с полным путем
```powershell
ssh -i "C:\Users\$env:USERNAME\.ssh\id_ed25519_selectel" root@79.143.30.96
```

### Вариант 3: С добавлением ключа в ssh-agent
```powershell
# Добавить ключ в ssh-agent
ssh-add "$env:USERPROFILE\.ssh\id_ed25519_selectel"
# Затем подключиться
ssh root@79.143.30.96
```

### Вариант 4: Если ключ не работает, подключитесь с паролем
```powershell
ssh root@79.143.30.96
# Введите пароль при запросе
```

### Вариант 5: Использовать SSH config (уже настроен)
```powershell
ssh selectel
```

**SSH config уже создан автоматически!** Просто используйте команду `ssh selectel`

## Основные команды для работы с CRM

### Переход в директорию проекта
```bash
cd /opt/flamecrm
```

### Проверка статуса контейнеров
```bash
docker-compose ps
```

### Просмотр логов приложения
```bash
docker-compose logs app
docker-compose logs postgres
```

### Перезапуск приложения
```bash
docker-compose restart app
```

### Остановка и запуск всех контейнеров
```bash
docker-compose down
docker-compose up -d
```

### Пересборка приложения
```bash
docker-compose stop app
docker-compose build app
docker-compose up -d app
```

### Обновление кода с GitHub
```bash
cd /opt/flamecrm
git pull origin main
docker-compose restart app
```

### Проверка здоровья приложения
```bash
curl http://127.0.0.1:3000/api/health
```

### Проверка манифеста
```bash
curl http://127.0.0.1:3000/manifest
```

### Перезагрузка Nginx
```bash
systemctl reload nginx
```

### Проверка переменных окружения
```bash
cat .env
```

### Подключение к базе данных
```bash
docker-compose exec postgres psql -U crm_user -d crm_db
```

### Проверка пользователей в базе
```bash
docker-compose exec postgres psql -U crm_user -d crm_db -c "SELECT email, name, role FROM \"User\";"
```

## Текущее состояние

- База данных: работает (crm_postgres)
- Приложение: остановлено (нужно запустить)
- Nginx: работает

## Что нужно сделать

1. Подключиться к серверу
2. Перейти в `/opt/flamecrm`
3. Запустить приложение: `docker-compose up -d app`
4. Проверить статус: `docker-compose ps`
5. Проверить манифест: `curl http://127.0.0.1:3000/manifest`

