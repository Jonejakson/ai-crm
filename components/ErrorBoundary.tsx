'use client'

import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    // Здесь можно отправить ошибку в сервис мониторинга
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
          <div className="max-w-md w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
              Произошла ошибка
            </h2>
            <p className="text-[var(--muted)] mb-4">
              Что-то пошло не так. Пожалуйста, попробуйте обновить страницу.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm text-[var(--muted)] mb-2">
                  Детали ошибки (только для разработки)
                </summary>
                <pre className="text-xs bg-[var(--background-soft)] p-3 rounded overflow-auto">
                  {this.state.error.toString()}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <div className="flex gap-3">
              <button
                onClick={this.resetError}
                className="btn-primary"
              >
                Попробовать снова
              </button>
              <button
                onClick={() => window.location.reload()}
                className="btn-secondary"
              >
                Обновить страницу
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

