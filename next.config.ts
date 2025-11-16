import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Оптимизация для продакшена
  reactStrictMode: true,
  
  // Компрессия для уменьшения размера бандла
  compress: true,
  
  // Оптимизация изображений
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  
  // Отключение source maps в продакшене для безопасности
  productionBrowserSourceMaps: false,
  
  // SWC minification включен по умолчанию в Next.js 16
  
  // Логирование только в development
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },
};

export default nextConfig;
