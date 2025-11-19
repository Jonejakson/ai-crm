'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="max-w-md w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
          Произошла ошибка
        </h2>
        <p className="text-[var(--muted)] mb-4">
          Что-то пошло не так. Пожалуйста, попробуйте снова.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-4">
            <summary className="cursor-pointer text-sm text-[var(--muted)] mb-2">
              Детали ошибки (только для разработки)
            </summary>
            <pre className="text-xs bg-[var(--background-soft)] p-3 rounded overflow-auto">
              {error.message}
              {error.stack}
            </pre>
          </details>
        )}
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="btn-primary"
          >
            Попробовать снова
          </button>
          <a
            href="/"
            className="btn-secondary"
          >
            На главную
          </a>
        </div>
      </div>
    </div>
  )
}

