import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Оптимизация для продакшена
  reactStrictMode: true,
  
  // Компрессия для уменьшения размера бандла
  compress: true,
  
  // Оптимизация изображений
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  
  // Включить source maps для Sentry в продакшене (только для Sentry, не публикуются)
  productionBrowserSourceMaps: true,
  
  // SWC minification включен по умолчанию в Next.js 16
  
  // Логирование только в development
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },
};

// Обернуть конфигурацию в Sentry, если DSN установлен
const sentryConfig = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      // Sentry опции
      silent: true, // Не выводить логи Sentry в консоль
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      
      // Source maps
      widenClientFileUpload: true,
      hideSourceMaps: true,
      disableLogger: true,
      
      // Автоматическая инструментация
      automaticVercelMonitors: true,
    })
  : nextConfig;

export default sentryConfig;
