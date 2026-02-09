# Настройка автодеплоя через GitHub Actions

При каждом `git push origin main` изменения автоматически выгружаются на сервер Selectel.

## Один раз: добавить SSH-ключ в GitHub

1. Откройте https://github.com/Jonejakson/ai-crm/settings/secrets/actions
2. **New repository secret**
3. Имя: `SSH_PRIVATE_KEY`
4. Значение: скопируйте **полное содержимое** файла приватного ключа:
   - `C:\Users\ВАШ_ЛОГИН\.ssh\id_ed25519_selectel` или
   - `C:\Users\ВАШ_ЛОГИН\.ssh\id_ed25519`
   
   Включая строки `-----BEGIN ... KEY-----` и `-----END ... KEY-----`.

5. Сохраните.

После этого каждый push в `main` будет автоматически деплоить на flamecrm.ru.
