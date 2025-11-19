import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-6xl font-bold text-[var(--primary)] mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
          Страница не найдена
        </h2>
        <p className="text-[var(--muted)] mb-6">
          Запрашиваемая страница не существует или была перемещена.
        </p>
        <Link
          href="/"
          className="btn-primary inline-block"
        >
          Вернуться на главную
        </Link>
      </div>
    </div>
  )
}

