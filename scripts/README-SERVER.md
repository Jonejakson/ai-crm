# Работа с сервером Selectel

## Подключение

Сервер: `root@79.143.30.96`  
Домен: `flamecrm.ru`  
Путь на сервере: `/opt/flamecrm`

## Быстрые команды

### Подключиться к серверу
```powershell
.\scripts\server-ssh.ps1
```

### Проверить статус на сервере
```powershell
.\scripts\server-sync.ps1 status
```

### Получить изменения с сервера
```powershell
.\scripts\server-sync.ps1 pull
```

### Отправить изменения на сервер
```powershell
.\scripts\server-sync.ps1 push
```

### Задеплоить изменения (pull + rebuild)
```powershell
.\scripts\server-sync.ps1 deploy
```

## Ручная работа с Git на сервере

```bash
# Подключиться к серверу
ssh root@79.143.30.96

# Перейти в директорию проекта
cd /opt/flamecrm

# Проверить статус
git status

# Получить изменения
git pull origin main

# Пересобрать и перезапустить
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Структура проекта на сервере

- `/opt/flamecrm` - основной проект
- `/root` - Docker файлы (docker-compose.yml, Dockerfile)
- Docker контейнеры:
  - `crm_app` - приложение Next.js
  - `crm_postgres` - база данных PostgreSQL

## Текущее состояние

На сервере есть незакоммиченные изменения:
- `Dockerfile`
- `deploy/nginx.conf`
- `docker-compose.yml`
- `package-lock.json`

Эти файлы теперь синхронизированы локально.

