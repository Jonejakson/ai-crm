/**
 * Скрипт для проверки переменных окружения
 * Запуск: node scripts/validate-env.js
 */

const requiredVars = {
  development: [
    'DATABASE_URL',
    'AUTH_SECRET',
    'NEXTAUTH_URL',
  ],
  production: [
    'DATABASE_URL',
    'AUTH_SECRET',
    'NEXTAUTH_URL',
    'ENCRYPTION_KEY',
  ],
};

const recommendedVars = [
  'OPENAI_API_KEY',
  'YOOKASSA_SHOP_ID',
  'YOOKASSA_SECRET_KEY',
];

function validateEnv() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const required = requiredVars[nodeEnv] || requiredVars.development;
  
  console.log('🔍 Проверка переменных окружения...\n');
  console.log(`Окружение: ${nodeEnv}\n`);
  
  let hasErrors = false;
  let hasWarnings = false;
  
  // Проверка обязательных переменных
  console.log('📋 Обязательные переменные:');
  required.forEach(varName => {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      console.log(`  ❌ ${varName} - НЕ УСТАНОВЛЕНА`);
      hasErrors = true;
    } else {
      // Дополнительные проверки
      if (varName === 'AUTH_SECRET' || varName === 'NEXTAUTH_SECRET') {
        if (value.length < 32) {
          console.log(`  ⚠️  ${varName} - слишком короткий (минимум 32 символа)`);
          hasWarnings = true;
        } else {
          console.log(`  ✅ ${varName} - установлена`);
        }
      } else if (varName === 'ENCRYPTION_KEY') {
        if (value.length < 64) {
          console.log(`  ⚠️  ${varName} - слишком короткий (минимум 64 символа hex)`);
          hasWarnings = true;
        } else if (!/^[0-9a-fA-F]+$/.test(value)) {
          console.log(`  ⚠️  ${varName} - должен содержать только hex символы (0-9, a-f)`);
          hasWarnings = true;
        } else {
          console.log(`  ✅ ${varName} - установлена`);
        }
      } else if (varName === 'DATABASE_URL') {
        if (!value.startsWith('postgresql://')) {
          console.log(`  ⚠️  ${varName} - должен начинаться с postgresql://`);
          hasWarnings = true;
        } else {
          console.log(`  ✅ ${varName} - установлена`);
        }
      } else {
        console.log(`  ✅ ${varName} - установлена`);
      }
    }
  });
  
  console.log('\n💡 Рекомендуемые переменные:');
  recommendedVars.forEach(varName => {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      console.log(`  ⚠️  ${varName} - не установлена (опционально)`);
      hasWarnings = true;
    } else {
      console.log(`  ✅ ${varName} - установлена`);
    }
  });
  
  console.log('\n' + '='.repeat(50));
  
  if (hasErrors) {
    console.log('\n❌ ОШИБКА: Некоторые обязательные переменные не установлены!');
    console.log('Пожалуйста, установите все обязательные переменные в .env файле.');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('\n⚠️  ПРЕДУПРЕЖДЕНИЕ: Некоторые переменные требуют внимания.');
    console.log('Приложение может работать, но рекомендуется исправить предупреждения.');
    process.exit(0);
  } else {
    console.log('\n✅ Все переменные окружения настроены правильно!');
    process.exit(0);
  }
}

// Запуск проверки
validateEnv();

