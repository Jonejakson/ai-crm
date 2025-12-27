# Скрипт для проверки и деплоя на сервер
$SERVER = "root@79.143.30.96"
$SERVER_PATH = "/opt/flamecrm"

Write-Host "=== Проверка локальных изменений ===" -ForegroundColor Cyan
git status

Write-Host "`n=== Последние коммиты локально ===" -ForegroundColor Cyan
git log --oneline -5

Write-Host "`n=== Проверка синхронизации с origin ===" -ForegroundColor Cyan
git fetch origin
$localCommits = git log --oneline origin/main..HEAD
if ($localCommits) {
    Write-Host "Есть локальные коммиты, которых нет на origin:" -ForegroundColor Yellow
    Write-Host $localCommits
    Write-Host "`nОтправляю на origin..." -ForegroundColor Yellow
    git push origin main
} else {
    Write-Host "Локальная ветка синхронизирована с origin/main" -ForegroundColor Green
}

Write-Host "`n=== Деплой на сервер ===" -ForegroundColor Cyan
Write-Host "Подключение к серверу и обновление кода..." -ForegroundColor Yellow

# Используем plink если доступен, иначе ssh из Git
$sshCmd = "ssh"
if (Test-Path "C:\Program Files\Git\usr\bin\ssh.exe") {
    $env:Path = "C:\Program Files\Git\usr\bin;$env:Path"
}

$deployScript = @"
cd $SERVER_PATH
echo '=== Текущий статус на сервере ==='
git status
echo ''
echo '=== Последние коммиты на сервере ==='
git log --oneline -5
echo ''
echo '=== Получение изменений с origin ==='
git fetch origin
echo ''
echo '=== Обновление кода ==='
git pull origin main
echo ''
echo '=== Перезапуск приложения ==='
docker-compose restart app
echo ''
echo '=== Проверка статуса ==='
docker-compose ps
"@

# Сохраняем скрипт во временный файл
$tempScript = [System.IO.Path]::GetTempFileName()
$deployScript | Out-File -FilePath $tempScript -Encoding UTF8

try {
    # Выполняем команды на сервере
    & $sshCmd $SERVER "bash -s" < $tempScript
} catch {
    Write-Host "Ошибка при подключении к серверу: $_" -ForegroundColor Red
    Write-Host "`nПопробуйте выполнить вручную:" -ForegroundColor Yellow
    Write-Host "ssh $SERVER `"cd $SERVER_PATH && git pull origin main && docker-compose restart app`""
} finally {
    Remove-Item $tempScript -ErrorAction SilentlyContinue
}

Write-Host "`n=== Готово ===" -ForegroundColor Green

