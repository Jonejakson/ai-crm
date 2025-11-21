/**
 * Скрипт для проверки и исправления DATABASE_URL
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Проверка переменных окружения...\n');

// Проверяем .env
const envPath = path.join(process.cwd(), '.env');
const envLocalPath = path.join(process.cwd(), '.env.local');

console.log('Проверка .env файла:');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
  if (dbUrlMatch) {
    const dbUrl = dbUrlMatch[1].replace(/^["']|["']$/g, '');
    console.log(`  DATABASE_URL: ${dbUrl.substring(0, 50)}...`);
    if (dbUrl.startsWith('file:')) {
      console.error('  ❌ Обнаружен SQLite URL!');
      console.error('  Исправьте на: DATABASE_URL="postgresql://postgres:Vergynia1997@localhost:5432/crm_db?schema=public"');
    } else if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
      console.log('  ✅ PostgreSQL URL правильный');
    }
  } else {
    console.log('  ⚠️ DATABASE_URL не найден');
  }
} else {
  console.log('  ⚠️ .env файл не найден');
}

console.log('\nПроверка .env.local файла:');
if (fs.existsSync(envLocalPath)) {
  const envLocalContent = fs.readFileSync(envLocalPath, 'utf8');
  const dbUrlMatch = envLocalContent.match(/DATABASE_URL=(.+)/);
  if (dbUrlMatch) {
    const dbUrl = dbUrlMatch[1].replace(/^["']|["']$/g, '');
    console.log(`  DATABASE_URL: ${dbUrl.substring(0, 50)}...`);
    if (dbUrl.startsWith('file:')) {
      console.error('  ❌ Обнаружен SQLite URL!');
    } else if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
      console.log('  ✅ PostgreSQL URL правильный');
    }
  } else {
    console.log('  ⚠️ DATABASE_URL не найден');
  }
} else {
  console.log('  ℹ️ .env.local файл не найден (это нормально)');
}

// Проверяем загрузку через dotenv
console.log('\nПроверка загрузки через dotenv:');
require('dotenv').config();
const loadedUrl = process.env.DATABASE_URL;
if (loadedUrl) {
  console.log(`  Загруженный DATABASE_URL: ${loadedUrl.substring(0, 50)}...`);
  if (loadedUrl.startsWith('file:')) {
    console.error('  ❌ Загружен SQLite URL!');
    console.error('  Это означает, что где-то в .env файлах все еще указан SQLite URL');
  } else if (loadedUrl.startsWith('postgresql://') || loadedUrl.startsWith('postgres://')) {
    console.log('  ✅ Загружен правильный PostgreSQL URL');
  }
} else {
  console.log('  ⚠️ DATABASE_URL не загружен');
}

console.log('\n✅ Проверка завершена');




