# Деплой на сервер - выполнить в PowerShell
$SERVER = "root@79.143.30.96"
$env:Path += ";C:\Program Files\Git\usr\bin"

Write-Host "=== Deploy to server ===" -ForegroundColor Cyan
$cmd = "cd /opt/flamecrm && git pull && ./scripts/safe-deploy.sh"
ssh $SERVER $cmd
Write-Host "=== Done ===" -ForegroundColor Green
