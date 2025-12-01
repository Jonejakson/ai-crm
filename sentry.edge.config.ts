/**
 * Sentry конфигурация для Edge Runtime (middleware, edge functions)
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Настройка окружения
  environment: process.env.NODE_ENV || "development",
  
  // Включить только если DSN указан (можно использовать бесплатный план Sentry)
  enabled: !!process.env.SENTRY_DSN,
  
  // Traces Sample Rate для Edge
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Игнорировать определенные ошибки
  ignoreErrors: [
    "Validation Error",
    "Unauthorized",
    "Forbidden",
  ],
  
  // Настройка контекста
  initialScope: {
    tags: {
      component: "edge",
    },
  },
});

