# Решение проблемы с SSH подключением

## Проблема: SSH запрашивает пароль вместо использования ключа

Если при подключении `ssh root@79.143.30.96` система запрашивает пароль, это означает, что SSH не находит или не использует ваш ключ автоматически.

---

## Решение 1: Явное указание ключа при подключении

### В PowerShell:

```powershell
# Использование первого ключа
ssh -i "$env:USERPROFILE\.ssh\id_ed25519" root@79.143.30.96

# Или использование второго ключа
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_pc2" root@79.143.30.96
```

### В Git Bash / MINGW64:

```bash
# Использование первого ключа
ssh -i ~/.ssh/id_ed25519 root@79.143.30.96

# Или использование второго ключа
ssh -i ~/.ssh/id_ed25519_pc2 root@79.143.30.96
```

---

## Решение 2: Настройка SSH config для автоматического использования ключа

Создайте или отредактируйте файл `~/.ssh/config` (или `C:\Users\ВашеИмя\.ssh\config` на Windows).

### На Windows (PowerShell):

```powershell
# Создание файла config
$configPath = "$env:USERPROFILE\.ssh\config"
if (-not (Test-Path $configPath)) {
    New-Item -Path $configPath -ItemType File
}

# Добавление конфигурации
@"
Host selectel-flame
    HostName 79.143.30.96
    User root
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
    PreferredAuthentications publickey
"@ | Out-File -FilePath $configPath -Encoding utf8
```

Теперь можно подключаться просто:
```bash
ssh selectel-flame
```

### На Linux/Mac или Git Bash:

Создайте файл `~/.ssh/config`:

```bash
nano ~/.ssh/config
```

Добавьте:

```
Host selectel-flame
    HostName 79.143.30.96
    User root
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
    PreferredAuthentications publickey
```

Сохраните: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## Решение 3: Проверка, что ключ добавлен в панель Selectel

**Важно:** SSH ключ должен быть добавлен в панель Selectel, иначе подключение не сработает!

### Как проверить:

1. Откройте панель Selectel: https://panel.selectel.com
2. Перейдите в "СЕРВЕРЫ" → выберите "flame-prod"
3. Проверьте раздел "SSH-keys for root user"
4. Убедитесь, что там есть ваш публичный ключ

### Как добавить ключ, если его нет:

1. Скопируйте публичный ключ:
   ```powershell
   # В PowerShell
   Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub" | Set-Clipboard
   ```

2. В панели Selectel:
   - Нажмите "Добавить новый или выбрать существующий"
   - Вставьте ключ (Ctrl+V)
   - Сохраните

---

## Решение 4: Для Git (если Git просит пароль)

Если Git просит пароль при работе с репозиторием, это другая проблема. Git использует SSH для подключения к GitHub/GitLab.

### Проверка SSH ключа для Git:

```powershell
# Проверка подключения к GitHub
ssh -T git@github.com

# Если не работает, добавьте ключ в GitHub:
# 1. Скопируйте публичный ключ
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub" | Set-Clipboard

# 2. В GitHub: Settings → SSH and GPG keys → New SSH key
# 3. Вставьте ключ и сохраните
```

### Настройка Git для использования SSH:

```bash
# Проверьте URL репозитория
git remote -v

# Если URL начинается с https://, измените на SSH:
git remote set-url origin git@github.com:Jonejakson/ai-crm.git
```

---

## Отладка SSH подключения

### Включите подробный вывод:

```bash
# Подробный вывод (verbose mode)
ssh -v -i ~/.ssh/id_ed25519 root@79.143.30.96

# Еще более подробный
ssh -vv -i ~/.ssh/id_ed25519 root@79.143.30.96

# Максимально подробный
ssh -vvv -i ~/.ssh/id_ed25519 root@79.143.30.96
```

Это покажет, какой ключ используется и почему он не работает.

---

## Частые проблемы и решения

### Проблема: "Permission denied (publickey)"

**Причины:**
1. Ключ не добавлен в панель Selectel
2. Используется неправильный ключ
3. Неправильные права доступа к ключу

**Решение:**
```powershell
# Проверьте права доступа (Windows)
icacls "$env:USERPROFILE\.ssh\id_ed25519"

# Если нужно, установите права
icacls "$env:USERPROFILE\.ssh\id_ed25519" /inheritance:r
icacls "$env:USERPROFILE\.ssh\id_ed25519" /grant:r "$env:USERNAME:(R)"
```

### Проблема: "Host key verification failed"

**Решение:**
```bash
# Удалите старую запись
ssh-keygen -R 79.143.30.96
```

### Проблема: SSH все равно просит пароль

**Проверьте:**
1. Ключ добавлен в панель Selectel? ✅
2. Используете правильный приватный ключ? ✅
3. Указали ключ явно с `-i`? ✅

Если все проверено, попробуйте:
```bash
ssh -v -i ~/.ssh/id_ed25519 -o PreferredAuthentications=publickey root@79.143.30.96
```

---

## Быстрая команда для подключения

Создайте алиас или функцию в PowerShell:

```powershell
# Добавьте в профиль PowerShell
function Connect-Selectel {
    ssh -i "$env:USERPROFILE\.ssh\id_ed25519" root@79.143.30.96
}

# Использование:
Connect-Selectel
```

Или создайте файл `connect-selectel.ps1`:

```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519" root@79.143.30.96
```

Затем запускайте:
```powershell
.\connect-selectel.ps1
```

---

## Итоговая инструкция

1. **Убедитесь, что ключ добавлен в панель Selectel** ✅
2. **Подключайтесь с явным указанием ключа:**
   ```bash
   ssh -i ~/.ssh/id_ed25519 root@79.143.30.96
   ```
3. **Или настройте SSH config** для автоматического использования ключа

После этого пароль запрашиваться не будет!


