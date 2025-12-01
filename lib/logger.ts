/**
 * Структурированное логирование для приложения
 * Поддерживает разные уровни логирования и интеграцию с Sentry
 */

// Sentry импортируется динамически, чтобы не ломать приложение если он недоступен
let Sentry: any = null;
try {
  Sentry = require("@sentry/nextjs");
} catch (error) {
  // Sentry не установлен или недоступен - работаем без него
  console.warn("Sentry not available, using console logging only");
}

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  FATAL = "fatal",
}

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: Error;
  userId?: number;
  companyId?: number;
  requestId?: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";
  private minLevel: LogLevel;

  constructor() {
    // В development логируем все, в production только WARN и выше
    this.minLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
  }

  /**
   * Проверить, нужно ли логировать на данном уровне
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL];
    const currentIndex = levels.indexOf(level);
    const minIndex = levels.indexOf(this.minLevel);
    return currentIndex >= minIndex;
  }

  /**
   * Форматировать лог для вывода
   */
  private formatLog(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
      entry.message,
    ];

    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(JSON.stringify(entry.context));
    }

    if (entry.userId) {
      parts.push(`userId:${entry.userId}`);
    }

    if (entry.companyId) {
      parts.push(`companyId:${entry.companyId}`);
    }

    if (entry.requestId) {
      parts.push(`requestId:${entry.requestId}`);
    }

    return parts.join(" ");
  }

  /**
   * Создать запись лога
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
    metadata?: { userId?: number; companyId?: number; requestId?: string }
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error,
      ...metadata,
    };
  }

  /**
   * Отправить в Sentry (только для ERROR и FATAL)
   * Работает только если Sentry инициализирован (DSN установлен)
   */
  private sendToSentry(entry: LogEntry) {
    // Проверяем, что Sentry доступен и инициализирован
    try {
      // Проверяем наличие DSN
      const hasSentryDSN = 
        typeof process !== 'undefined' && 
        (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
      
      if (!hasSentryDSN) {
        return; // Sentry не настроен, просто пропускаем
      }

      if (entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL) {
        const sentryLevel = entry.level === LogLevel.FATAL ? "fatal" : "error";
        
        Sentry.withScope((scope) => {
          // Установить уровень
          scope.setLevel(sentryLevel);
          
          // Добавить контекст
          if (entry.context) {
            scope.setContext("logContext", entry.context);
          }
          
          // Добавить теги
          if (entry.userId) {
            scope.setTag("userId", entry.userId.toString());
          }
          
          if (entry.companyId) {
            scope.setTag("companyId", entry.companyId.toString());
          }
          
          if (entry.requestId) {
            scope.setTag("requestId", entry.requestId);
          }
          
          // Отправить ошибку или сообщение
          if (entry.error) {
            Sentry.captureException(entry.error);
          } else {
            Sentry.captureMessage(entry.message, sentryLevel);
          }
        });
      }
    } catch (error) {
      // Если Sentry недоступен (блокировка, ошибка инициализации), просто логируем в консоль
      console.error("Failed to send to Sentry:", error);
      // Продолжаем работу без Sentry
    }
  }

  /**
   * DEBUG - детальная информация для отладки
   */
  debug(message: string, context?: LogContext, metadata?: { userId?: number; companyId?: number; requestId?: string }) {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const entry = this.createLogEntry(LogLevel.DEBUG, message, context, undefined, metadata);
    
    if (this.isDevelopment) {
      console.debug(this.formatLog(entry));
    }
  }

  /**
   * INFO - информационные сообщения
   */
  info(message: string, context?: LogContext, metadata?: { userId?: number; companyId?: number; requestId?: string }) {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const entry = this.createLogEntry(LogLevel.INFO, message, context, undefined, metadata);
    
    if (this.isDevelopment) {
      console.info(this.formatLog(entry));
    } else {
      console.log(this.formatLog(entry));
    }
  }

  /**
   * WARN - предупреждения
   */
  warn(message: string, context?: LogContext, metadata?: { userId?: number; companyId?: number; requestId?: string }) {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const entry = this.createLogEntry(LogLevel.WARN, message, context, undefined, metadata);
    
    console.warn(this.formatLog(entry));
  }

  /**
   * ERROR - ошибки
   */
  error(
    message: string,
    error?: Error | unknown,
    context?: LogContext,
    metadata?: { userId?: number; companyId?: number; requestId?: string }
  ) {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const err = error instanceof Error ? error : undefined;
    const entry = this.createLogEntry(LogLevel.ERROR, message, context, err, metadata);
    
    console.error(this.formatLog(entry));
    if (err) {
      console.error(err);
    }
    
    // Отправить в Sentry
    this.sendToSentry(entry);
  }

  /**
   * FATAL - критические ошибки
   */
  fatal(
    message: string,
    error?: Error | unknown,
    context?: LogContext,
    metadata?: { userId?: number; companyId?: number; requestId?: string }
  ) {
    const err = error instanceof Error ? error : undefined;
    const entry = this.createLogEntry(LogLevel.FATAL, message, context, err, metadata);
    
    console.error(this.formatLog(entry));
    if (err) {
      console.error(err);
    }
    
    // Отправить в Sentry
    this.sendToSentry(entry);
  }

  /**
   * Логировать API запрос
   */
  logRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    metadata?: { userId?: number; companyId?: number; requestId?: string }
  ) {
    const level = statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    const message = `${method} ${path} ${statusCode} ${duration}ms`;
    
    this.log(level, message, { statusCode, duration }, undefined, metadata);
  }

  /**
   * Универсальный метод логирования
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
    metadata?: { userId?: number; companyId?: number; requestId?: string }
  ) {
    const entry = this.createLogEntry(level, message, context, error, metadata);
    
    switch (level) {
      case LogLevel.DEBUG:
        if (this.isDevelopment) {
          console.debug(this.formatLog(entry));
        }
        break;
      case LogLevel.INFO:
        if (this.isDevelopment) {
          console.info(this.formatLog(entry));
        } else {
          console.log(this.formatLog(entry));
        }
        break;
      case LogLevel.WARN:
        console.warn(this.formatLog(entry));
        break;
      case LogLevel.ERROR:
        console.error(this.formatLog(entry));
        if (error) {
          console.error(error);
        }
        this.sendToSentry(entry);
        break;
      case LogLevel.FATAL:
        console.error(this.formatLog(entry));
        if (error) {
          console.error(error);
        }
        this.sendToSentry(entry);
        break;
    }
  }
}

// Экспортировать singleton экземпляр
export const logger = new Logger();

// Экспортировать класс для создания кастомных логгеров
export { Logger };

