# Выполнить в PowerShell из папки проекта: c:\ai-crm\my-app\ai-crm
# 1) Закоммитить и отправить на GitHub
# 2) Обновить код на сервере и перезапустить приложение

$ErrorActionPreference = "Stop"
$projectRoot = "c:\ai-crm\my-app\ai-crm"
$sshExe = "C:\Windows\System32\OpenSSH\ssh.exe"
$server = "root@79.143.30.96"
$key = "$env:USERPROFILE\.ssh\id_ed25519"
$serverPath = "/opt/flamecrm"

Set-Location $projectRoot

Write-Host "=== 1. Коммит и push ===" -ForegroundColor Cyan
git add -A
git status
git commit -m "Бета-пометки интеграций, вебформы, лимиты, middleware"
git push origin main

Write-Host "`n=== 2. Деплой на сервер ===" -ForegroundColor Cyan
& $sshExe -i $key $server "cd $serverPath && git pull origin main && docker-compose restart app && docker-compose ps"

Write-Host "`n=== Готово ===" -ForegroundColor Green
