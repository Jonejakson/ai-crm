'use client'

import { useState, useEffect } from 'react'
import { signIn as nextAuthSignIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')

  // Принудительно устанавливаем светлую тему на странице логина
  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    if (isRegister) {
      // Регистрация
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Ошибка при регистрации')
          setIsLoading(false)
          return
        }

        console.log('Registration successful:', data)

        // После регистрации автоматически входим
        // Небольшая задержка, чтобы база данных успела обновиться
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const result = await nextAuthSignIn('credentials', {
          email,
          password,
          redirect: false,
        })

        if (result?.error) {
          // Если автоматический вход не сработал, предлагаем войти вручную
          console.error('Ошибка автоматического входа:', result.error)
          setError('Регистрация успешна! Пожалуйста, войдите вручную.')
          setIsRegister(false) // Переключаем на форму входа
          setEmail(email) // Сохраняем email
          setPassword('') // Очищаем пароль
        } else {
          router.push('/')
          router.refresh()
        }
      } catch (err) {
        setError('Ошибка сети')
      }
    } else {
      // Вход
      const result = await nextAuthSignIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Неверный email или пароль')
      } else {
        router.push('/')
        router.refresh()
      }
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50" data-theme="light">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-xl border border-gray-200 animate-fadeIn">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            {isRegister ? 'Регистрация' : 'Вход в CRM'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isRegister 
              ? 'Создайте новый аккаунт' 
              : 'Войдите в систему для продолжения'}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {isRegister && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Имя
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required={isRegister}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-all duration-200"
                placeholder="Ваше имя"
              />
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
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Пароль
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Пароль"
              minLength={6}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-200 active:scale-95"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Загрузка...
                </span>
              ) : (
                isRegister ? 'Зарегистрироваться' : 'Войти'
              )}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister)
                setError('')
              }}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              {isRegister 
                ? 'Уже есть аккаунт? Войти' 
                : 'Нет аккаунта? Зарегистрироваться'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

