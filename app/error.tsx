'use client'

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Проверка онлайн статуса
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Отправить ошибку в Sentry (если доступен)
    try {
      const Sentry = require("@sentry/nextjs");
      if (Sentry && process.env.NEXT_PUBLIC_SENTRY_DSN) {
        Sentry.captureException(error);
      }
    } catch (e) {
      // Sentry недоступен - просто логируем в консоль
      console.error("Error (Sentry not available):", error);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="max-w-md w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
        <div className="text-center mb-4">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
            Произошла ошибка
          </h2>
          <p className="text-[var(--muted)] mb-4">
            {!isOnline 
              ? "Похоже, у вас нет подключения к интернету. Проверьте соединение и попробуйте снова."
              : "Что-то пошло не так. Пожалуйста, попробуйте снова."
            }
          </p>
        </div>

        {!isOnline && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ Нет подключения к интернету
          </div>
        )}

        {process.env.NODE_ENV === 'development' && (
          <details className="mb-4">
            <summary className="cursor-pointer text-sm text-[var(--muted)] mb-2 hover:text-[var(--foreground)]">
              Детали ошибки (только для разработки)
            </summary>
            <pre className="text-xs bg-[var(--background-soft)] p-3 rounded overflow-auto max-h-60">
              <div className="font-semibold mb-1">Сообщение:</div>
              <div className="mb-2">{error.message}</div>
              {error.digest && (
                <>
                  <div className="font-semibold mb-1">Digest:</div>
                  <div className="mb-2">{error.digest}</div>
                </>
              )}
              {error.stack && (
                <>
                  <div className="font-semibold mb-1">Stack:</div>
                  <div>{error.stack}</div>
                </>
              )}
            </pre>
          </details>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={reset}
            className="btn-primary flex-1"
            disabled={!isOnline}
          >
            Попробовать снова
          </button>
          <Link
            href="/"
            className="btn-secondary flex-1 text-center"
          >
            На главную
          </Link>
        </div>

        {process.env.NODE_ENV === 'production' && (
          <p className="text-xs text-[var(--muted)] mt-4 text-center">
            Если проблема сохраняется, пожалуйста, свяжитесь с поддержкой
          </p>
        )}
      </div>
    </div>
  )
}

