# Оптимизация памяти на сервере

Health API показывает `memory: 97%` — сервер использует почти всю доступную RAM.

## Что сделать

### 1. Увеличить RAM на VPS (Selectel)
- В панели Selectel: VPS → ваш сервер → Изменить конфигурацию
- Рекомендуемый минимум для CRM: **2 GB RAM**
- Если сейчас 1 GB — увеличьте до 2 GB

### 2. Ограничить память контейнеров (Docker)
Добавьте в `docker-compose.yml` лимиты, чтобы один контейнер не съедал всё:

```yaml
app:
  # ... существующие настройки ...
  deploy:
    resources:
      limits:
        memory: 1G
      reservations:
        memory: 512M
```

### 3. Включить swap (если ещё нет)
На сервере:
```bash
# Проверить swap
free -h

# Создать swap 1GB (если нет)
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 4. Оптимизация Node.js
В `Dockerfile` или переменных окружения для app:
```
NODE_OPTIONS=--max-old-space-size=768
```
(768 MB для heap Node.js — оставляет место для системы)

### 5. Проверить утечки
```bash
docker stats
docker-compose logs app --tail 500
```
Ищите рост памяти со временем — возможно, нужен периодический restart.

### 6. Cron для перезапуска (если память растёт)
```bash
# Перезапуск app раз в сутки в 4:00
0 4 * * * cd /opt/flamecrm && docker-compose restart app
```

## Быстрый чеклист
- [ ] Проверить `free -h` на сервере
- [ ] Добавить swap, если RAM < 2 GB
- [ ] Увеличить тариф VPS до 2 GB
- [ ] Добавить `deploy.resources.limits.memory` в docker-compose
- [ ] Установить `NODE_OPTIONS=--max-old-space-size=768`
