/**
 * Sentry конфигурация для клиентской части (браузер)
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Настройка окружения
  environment: process.env.NODE_ENV || "development",
  
  // Включить только если DSN указан (можно использовать бесплатный план Sentry)
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Traces Sample Rate - процент запросов для трейсинга (0.0 - 1.0)
  // В продакшене рекомендуется 0.1 (10%) для экономии квоты
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Replay Sample Rate - процент сессий для записи (0.0 - 1.0)
  // Session Replay помогает воспроизвести действия пользователя перед ошибкой
  replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Replay On Error Sample Rate - процент сессий с ошибками для записи
  replaysOnErrorSampleRate: 1.0,
  
  // Интеграции
  integrations: [
    Sentry.replayIntegration({
      // Маскировать чувствительные данные
      maskAllText: false,
      blockAllMedia: false,
    }),
    Sentry.browserTracingIntegration(),
  ],
  
  // Игнорировать определенные ошибки
  ignoreErrors: [
    // Игнорировать ошибки от расширений браузера
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
    // Игнорировать ошибки от сторонних скриптов
    /^Script error\.?$/,
    /^Javascript error: Script error\.?$/i,
  ],
  
  // Фильтровать транзакции
  beforeSend(event, hint) {
    // Не отправлять ошибки в development без DSN
    if (process.env.NODE_ENV === "development" && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
      return null;
    }
    
    // Логировать ошибки в консоль в development
    if (process.env.NODE_ENV === "development") {
      console.error("Sentry Event:", event);
      console.error("Sentry Hint:", hint);
    }
    
    return event;
  },
  
  // Настройка контекста
  initialScope: {
    tags: {
      component: "client",
    },
  },
});

