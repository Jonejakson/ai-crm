'use client'

import { useState, useEffect } from 'react'
import { signIn as nextAuthSignIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type UserType = 'individual' | 'legal'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [userType, setUserType] = useState<UserType>('individual')
  
  // Общие поля
  const [name, setName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  
  // Поля для юр лица
  const [companyName, setCompanyName] = useState('')
  const [inn, setInn] = useState('')

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
        const registerData: any = {
          email,
          password,
          name: name.trim(), // Только имя
          lastName: lastName.trim(), // Фамилия отдельно
          phone,
          userType,
        }

        // Добавляем поля для юр лица
        if (userType === 'legal') {
          registerData.companyName = companyName
          registerData.inn = inn
        }

        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(registerData),
        })

        const data = await res.json()

        if (!res.ok) {
          // Показываем более понятное сообщение об ошибке
          const errorMessage = data.message || data.error || 'Ошибка при регистрации'
          setError(errorMessage)
          setIsLoading(false)
          return
        }

        console.log('Registration successful:', data)

        // После успешной регистрации предлагаем войти вручную
        // Это более надежно, чем автоматический вход сразу после регистрации
        setError('')
        setIsRegister(false) // Переключаем на форму входа
        setEmail(email) // Сохраняем email для удобства
        setPassword('') // Очищаем пароль, чтобы пользователь ввел его заново
        
        // Показываем успешное сообщение через alert или через состояние
        alert('Регистрация успешна! Теперь войдите в систему.')
        
        setIsLoading(false)
        return // Завершаем выполнение, не пытаемся автоматически войти
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
            <>
              {/* Вкладки Физ лицо / Юр лицо */}
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setUserType('individual')
                    setError('')
                  }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    userType === 'individual'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Физ лицо
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserType('legal')
                    setError('')
                  }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    userType === 'legal'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Юр лицо
                </button>
              </div>

              {/* Поля для физ/юр лица */}
              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                    Фамилия
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required={isRegister}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-all duration-200"
                    placeholder="Ваша фамилия"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Контактный номер
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required={isRegister}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-all duration-200"
                  placeholder="+7 (999) 123-45-67"
                />
              </div>

              {/* Поля для юр лица */}
              {userType === 'legal' && (
                <>
                  <div>
                    <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
                      Название компании
                    </label>
                    <input
                      id="companyName"
                      name="companyName"
                      type="text"
                      required={userType === 'legal'}
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-all duration-200"
                      placeholder="Название компании"
                    />
                  </div>
                  <div>
                    <label htmlFor="inn" className="block text-sm font-medium text-gray-700">
                      ИНН
                    </label>
                    <input
                      id="inn"
                      name="inn"
                      type="text"
                      required={userType === 'legal'}
                      value={inn}
                      onChange={(e) => setInn(e.target.value)}
                      className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-all duration-200"
                      placeholder="1234567890"
                      maxLength={12}
                      pattern="[0-9]{10,12}"
                    />
                  </div>
                </>
              )}

              {/* Информация об оплате для физ лица */}
              {userType === 'individual' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 font-medium mb-2">Способы оплаты:</p>
                  <div className="space-y-2 text-sm text-blue-700">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Оплата по QR коду
                    </div>
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      Оплата по номеру карты
                    </div>
                  </div>
                </div>
              )}
            </>
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

