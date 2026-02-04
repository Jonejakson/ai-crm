# Полный деплой на Selectel: push, pull, build, migrate
# Запуск: .\scripts\deploy-now.ps1
# Или: powershell -ExecutionPolicy Bypass -File .\scripts\deploy-now.ps1

$SERVER = "root@79.143.30.96"
$SERVER_PATH = "/opt/flamecrm"

Write-Host "=== 1. Push to GitHub ===" -ForegroundColor Cyan
git push origin main
if ($LASTEXITCODE -ne 0) { Write-Host "Push error"; exit 1 }

Write-Host "`n=== 2. Deploy to server ===" -ForegroundColor Cyan
$script = @"
cd $SERVER_PATH
git pull origin main
docker-compose down
docker-compose build --no-cache app
docker-compose up -d
sleep 15
docker-compose exec -T app npx -y prisma@6.19.0 migrate deploy
docker-compose ps
echo ''
echo '=== Done ==='
"@

ssh $SERVER $script

Write-Host "`nDeploy done. Check flamecrm.ru" -ForegroundColor Green
