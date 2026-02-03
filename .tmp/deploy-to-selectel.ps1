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
git commit -m "fix(deals): МойСклад позиции - только номенклатура, кол-во, цена; убрать сумму и итого; выровнять"
git push origin main

Write-Host "`n=== 2. Деплой на сервер ===" -ForegroundColor Cyan
# Важно: restart не пересобирает образ! Код вшит в образ при build.
# Нужны: pull → build --no-cache → down → up -d
$deployCmd = 'cd ' + $serverPath + ' && git pull origin main && docker-compose down && docker-compose build --no-cache app && docker-compose up -d && sleep 15 && (docker-compose exec -T app npx -y prisma@6.19.0 migrate deploy 2>/dev/null || true) && docker-compose ps'
& $sshExe -i $key $server $deployCmd

Write-Host "`n=== Готово ===" -ForegroundColor Green
