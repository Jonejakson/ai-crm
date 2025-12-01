/**
 * Sentry конфигурация для серверной части (Node.js)
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Настройка окружения
  environment: process.env.NODE_ENV || "development",
  
  // Включить только если DSN указан (можно использовать бесплатный план Sentry)
  enabled: !!process.env.SENTRY_DSN,
  
  // Traces Sample Rate - процент запросов для трейсинга
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Интеграции
  integrations: [
    Sentry.prismaIntegration(),
    Sentry.httpIntegration(),
  ],
  
  // Игнорировать определенные ошибки
  ignoreErrors: [
    // Игнорировать ошибки валидации (они обрабатываются отдельно)
    "Validation Error",
    "ZodError",
    // Игнорировать ошибки авторизации (это нормально)
    "Unauthorized",
    "Forbidden",
  ],
  
  // Фильтровать события
  beforeSend(event, hint) {
    // Не отправлять ошибки в development без DSN
    if (process.env.NODE_ENV === "development" && !process.env.SENTRY_DSN) {
      return null;
    }
    
    // Логировать ошибки в консоль в development
    if (process.env.NODE_ENV === "development") {
      console.error("Sentry Server Event:", event);
      console.error("Sentry Server Hint:", hint);
    }
    
    // Добавить дополнительный контекст
    if (hint.originalException) {
      event.extra = {
        ...event.extra,
        originalException: hint.originalException,
      };
    }
    
    return event;
  },
  
  // Настройка контекста
  initialScope: {
    tags: {
      component: "server",
    },
  },
});

