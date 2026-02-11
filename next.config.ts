import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Режим standalone для Docker
  output: 'standalone',
  
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

  // Turbopack config: mirror aliases to avoid pdfkit/fontkit ESM helpers issues (only if modules exist)
  turbopack: {
    resolveAlias: (() => {
      const alias: Record<string, string> = {};
      try {
        alias.pdfkit = require.resolve('pdfkit');
      } catch {
        // pdfkit not installed or not resolvable at config load time
      }
      try {
        alias.fontkit = require.resolve('fontkit');
      } catch {
        // fontkit not installed or not resolvable at config load time
      }
      return alias;
    })(),
  },

  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
    };
    try {
      config.resolve.alias!.pdfkit = require.resolve('pdfkit');
    } catch {
      // pdfkit not resolvable at config load time
    }
    try {
      config.resolve.alias!.fontkit = require.resolve('fontkit');
    } catch {
      // fontkit not resolvable at config load time
    }
    return config;
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
      sourcemaps: {
        assets: './.next/**',
        ignore: ['node_modules'],
        deleteSourcemapsAfterUpload: true,
      },
      disableLogger: true,
      
      // Автоматическая инструментация
      automaticVercelMonitors: true,
    })
  : nextConfig;

export default sentryConfig;
