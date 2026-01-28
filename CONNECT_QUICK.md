# Быстрое подключение: GitHub + Selectel

Выполняйте команды в **PowerShell** или **Git Bash** (не в песочнице Cursor).

---

## GitHub

```powershell
ssh -T git@github.com
```

Успех: `Hi username! You've successfully authenticated...`

Если не подхватывается ключ:
```powershell
ssh-add $env:USERPROFILE\.ssh\id_ed25519
ssh -T git@github.com
```

---

## Сервер Selectel

**Вариант 1** — если в `~/.ssh/config` есть хост `selectel`:
```powershell
ssh selectel
```

**Вариант 2** — с указанием ключа:
```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_selectel" root@79.143.30.96
```

**Вариант 3** — ключ по умолчанию:
```powershell
ssh root@79.143.30.96
```

---

## Настройка ~/.ssh/config (один раз)

Файл: `C:\Users\ВАШ_ЛОГИН\.ssh\config`

Добавьте блок для Selectel (подставьте свой путь к ключу):

```
Host selectel
    HostName 79.143.30.96
    User root
    IdentityFile ~/.ssh/id_ed25519_selectel
    IdentitiesOnly yes
```

После этого достаточно: `ssh selectel`

---

## На сервере Selectel

- Проект: `cd /opt/flamecrm`
- Логи: `docker-compose logs app`
- Рестарт: `docker-compose restart app`
- Обновление с GitHub: `git pull origin main` затем `docker-compose restart app`

Подробнее: [SERVER_ACCESS.md](./SERVER_ACCESS.md)
