# Скрипт для синхронизации с сервером Selectel
# Использование: .\scripts\server-sync.ps1 [pull|push|status|deploy]

$SERVER = "root@79.143.30.96"
$SERVER_PATH = "/opt/flamecrm"
$SSH_PATH = "C:\Program Files\Git\usr\bin"

# Добавляем SSH в PATH
$env:Path += ";$SSH_PATH"

$action = $args[0]
if (-not $action) {
    $action = "status"
}

function Get-ServerStatus {
    Write-Host "=== Статус на сервере ===" -ForegroundColor Cyan
    ssh $SERVER "cd $SERVER_PATH && git status"
    Write-Host "`n=== Последние коммиты ===" -ForegroundColor Cyan
    ssh $SERVER "cd $SERVER_PATH && git log --oneline -5"
}

function Pull-FromServer {
    Write-Host "Получение изменений с сервера..." -ForegroundColor Yellow
    ssh $SERVER "cd $SERVER_PATH && git stash && git pull origin main"
    Write-Host "Изменения получены!" -ForegroundColor Green
}

function Push-ToServer {
    Write-Host "Отправка изменений на сервер..." -ForegroundColor Yellow
    
    # Сначала пушим локально
    git push origin main
    
    # Затем пулим на сервере
    ssh $SERVER "cd $SERVER_PATH && git pull origin main"
    
    Write-Host "Изменения отправлены на сервер!" -ForegroundColor Green
}

function Deploy-ToServer {
    Write-Host "Деплой на сервер..." -ForegroundColor Yellow
    
    # Пушим изменения
    git push origin main
    
    # На сервере: пулим, пересобираем, применяем миграции
    ssh $SERVER @"
cd $SERVER_PATH
git pull origin main
docker-compose down
docker-compose build --no-cache app
docker-compose up -d
echo 'Ожидание готовности PostgreSQL...'
sleep 15
echo 'Применение миграций...'
docker-compose exec -T app npx -y prisma@6.19.0 migrate deploy
echo 'Деплой завершен!'
docker-compose ps
"@
    
    Write-Host "Деплой завершен!" -ForegroundColor Green
}

switch ($action) {
    "status" { Get-ServerStatus }
    "pull" { Pull-FromServer }
    "push" { Push-ToServer }
    "deploy" { Deploy-ToServer }
    default {
        Write-Host "Использование: .\scripts\server-sync.ps1 [status|pull|push|deploy]" -ForegroundColor Yellow
        Write-Host "  status - показать статус на сервере" -ForegroundColor Gray
        Write-Host "  pull   - получить изменения с сервера" -ForegroundColor Gray
        Write-Host "  push   - отправить изменения на сервер" -ForegroundColor Gray
        Write-Host "  deploy - задеплоить изменения на сервер" -ForegroundColor Gray
    }
}

