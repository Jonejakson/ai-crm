# Установка OpenSSH на Windows

Если в PowerShell команда `ssh` не найдена — установите клиент OpenSSH.

## Способ 1: PowerShell (от имени администратора)

1. Откройте **PowerShell от имени администратора** (правый клик по меню Пуск → Windows PowerShell (Admin)).
2. Проверьте, установлен ли OpenSSH:
   ```powershell
   Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH*'
   ```
3. Если у **OpenSSH.Client** состояние **Not Present**, установите:
   ```powershell
   Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
   ```
4. Закройте и снова откройте PowerShell (обычный). Проверьте:
   ```powershell
   ssh -V
   ```

## Способ 2: Через Параметры Windows

1. **Параметры** → **Приложения** → **Дополнительные компоненты** (или «Управление дополнительными компонентами»).
2. **Добавить компонент**.
3. Найдите **OpenSSH-клиент** → **Установить**.

После установки откройте **новое** окно PowerShell и подключайтесь.

Если команда `ssh` не находится (например, перехватывается `ssh.bat` из `.sbx-denybin`), используйте полный путь:

```powershell
& "C:\Windows\System32\OpenSSH\ssh.exe" -i $env:USERPROFILE\.ssh\id_ed25519 root@79.143.30.96
```

Когда будет работать — можно добавить алиас в профиль PowerShell или вызывать так:

```powershell
# Один раз в сессии — задать алиас
Set-Alias -Name ssh -Value "C:\Windows\System32\OpenSSH\ssh.exe"
ssh -i $env:USERPROFILE\.ssh\id_ed25519 root@79.143.30.96
```

Либо удалите/переименуйте мешающий файл `C:\Users\mallo\.sbx-denybin\ssh.bat`, тогда в PATH будет использоваться настоящий `ssh`.
