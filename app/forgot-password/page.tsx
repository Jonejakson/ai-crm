'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка при отправке запроса')
      }

      setSuccess(true)
    } catch (error: any) {
      setError(error.message || 'Ошибка при отправке запроса')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Восстановление пароля
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Введите ваш email, и мы отправим вам инструкции по восстановлению пароля
          </p>
        </div>

        {success ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 text-sm">
              Если пользователь с таким email существует, на него будет отправлено письмо с инструкциями по восстановлению пароля.
            </p>
            <p className="text-green-700 text-xs mt-2">
              Проверьте папку "Спам", если письмо не пришло в течение нескольких минут.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-500"
            >
              ← Вернуться к входу
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-all duration-200"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isLoading ? 'Отправка...' : 'Отправить инструкции'}
              </button>
            </div>

            <div className="text-center">
              <Link
                href="/login"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                ← Вернуться к входу
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

