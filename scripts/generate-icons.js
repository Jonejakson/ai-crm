// Скрипт для генерации иконок PWA
// Требуется: npm install sharp (или используйте онлайн-конвертеры)

const fs = require('fs');
const path = require('path');

// SVG иконка (простой логотип Pocket CRM)
const svgIcon = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3f6ff5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#6366f1;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="120" fill="url(#grad)"/>
  <g transform="translate(128, 128)">
    <!-- Иконка кармана/кошелька -->
    <path d="M256 64C256 28.6538 227.346 0 192 0C156.654 0 128 28.6538 128 64C128 99.3462 156.654 128 192 128C227.346 128 256 99.3462 256 64Z" fill="white" opacity="0.9"/>
    <rect x="80" y="100" width="224" height="160" rx="20" fill="white" opacity="0.9"/>
    <rect x="80" y="200" width="224" height="20" rx="10" fill="url(#grad)"/>
    <circle cx="192" cy="140" r="20" fill="url(#grad)"/>
  </g>
  <text x="256" y="400" font-family="Arial, sans-serif" font-size="80" font-weight="bold" fill="white" text-anchor="middle">CRM</text>
</svg>
`;

// Размеры иконок для PWA
const iconSizes = [
  { size: 16, name: 'icon-16x16.png' },
  { size: 32, name: 'icon-32x32.png' },
  { size: 72, name: 'icon-72x72.png' },
  { size: 96, name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' },
];

// Сохраняем SVG
const publicDir = path.join(__dirname, '..', 'public');
const svgPath = path.join(publicDir, 'icon.svg');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(svgPath, svgIcon);
console.log('✅ SVG иконка создана:', svgPath);

// Проверяем наличие sharp
try {
  const sharp = require('sharp');
  
  console.log('🔄 Генерация PNG иконок...');
  
  Promise.all(
    iconSizes.map(({ size, name }) => {
      const outputPath = path.join(publicDir, name);
      return sharp(Buffer.from(svgIcon))
        .resize(size, size)
        .png()
        .toFile(outputPath)
        .then(() => {
          console.log(`✅ Создана иконка: ${name} (${size}x${size})`);
        });
    })
  ).then(() => {
    console.log('\n🎉 Все иконки успешно созданы!');
  }).catch((error) => {
    console.error('❌ Ошибка при создании иконок:', error);
    console.log('\n💡 Альтернатива: используйте онлайн-конвертер SVG в PNG');
    console.log('   Например: https://convertio.co/svg-png/');
    console.log(`   Загрузите файл: ${svgPath}`);
  });
  
} catch (error) {
  console.log('\n⚠️  Sharp не установлен. Установите: npm install sharp');
  console.log('💡 Альтернатива: используйте онлайн-конвертер');
  console.log('   1. Откройте https://realfavicongenerator.net/');
  console.log('   2. Загрузите icon.svg из папки public');
  console.log('   3. Скачайте сгенерированные иконки');
  console.log('   4. Поместите их в папку public');
  console.log(`\n📁 SVG файл сохранен: ${svgPath}`);
}

