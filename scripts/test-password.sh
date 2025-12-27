#!/bin/bash

# Скрипт для тестирования пароля

echo "=== Тестирование пароля ==="
docker-compose exec -T app node << 'EOF'
const bcrypt = require('bcryptjs');

// Хеш из базы данных (первые 30 символов)
const storedHash = '$2b$10$UkYbkvB/NLO0yhKMirU83eN';

// Тестовые пароли
const testPasswords = ['password123', 'password', 'admin', '123456'];

console.log('Проверяем пароли...\n');

// Получаем полный хеш из базы
const { execSync } = require('child_process');
const fullHash = execSync('docker-compose exec -T postgres psql -U crm_user -d crm_db -t -c "SELECT password FROM \\\"User\\\" WHERE email = '\''sale2@barier-yug.ru'\'';"', { encoding: 'utf-8' }).trim();

console.log('Полный хеш:', fullHash.substring(0, 30) + '...');
console.log('Длина хеша:', fullHash.length);
console.log('');

testPasswords.forEach(async (password) => {
  try {
    const match = await bcrypt.compare(password, fullHash);
    console.log(`Пароль "${password}": ${match ? '✅ СОВПАДАЕТ' : '❌ не совпадает'}`);
  } catch (error) {
    console.error(`Ошибка при проверке "${password}":`, error.message);
  }
}));
EOF

