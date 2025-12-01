/**
 * Упрощенный логгер БЕЗ Sentry
 * Используйте этот вариант, если Sentry недоступен или не нужен
 */

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

class SimpleLogger {
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
    
    const entry = this.createLogEntry(level, message, { statusCode, duration }, undefined, metadata);
    
    // level может быть только INFO, WARN или ERROR (в зависимости от statusCode)
    switch (level) {
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
        break;
      default:
        // Этот case никогда не должен выполниться, но TypeScript требует его
        console.log(this.formatLog(entry));
    }
  }
}

// Экспортировать singleton экземпляр
export const logger = new SimpleLogger();

// Экспортировать класс для создания кастомных логгеров
export { SimpleLogger };

