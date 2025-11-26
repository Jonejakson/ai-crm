'use client'

import { useState, useEffect } from 'react'

// Компонент для подключения личных аккаунтов менеджеров
export default function PersonalMessagingAccountsSection() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [connectingPlatform, setConnectingPlatform] = useState<'TELEGRAM' | 'WHATSAPP' | null>(null)
  const [formData, setFormData] = useState({
    phone: '',
    telegramApiId: '',
    telegramApiHash: '',
    code: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [waitingForCode, setWaitingForCode] = useState(false)

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/messaging/personal/connect')
      if (response.ok) {
        const data = await response.json()
        setAccounts(Array.isArray(data) ? data : [])
      } else {
        // Если ошибка, устанавливаем пустой массив
        setAccounts([])
        const errorData = await response.json().catch(() => ({}))
        console.error('Error fetching accounts:', errorData.error || 'Unknown error')
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = (platform: 'TELEGRAM' | 'WHATSAPP') => {
    setConnectingPlatform(platform)
    setError('')
    setSuccess('')
    setWaitingForCode(false)
    setFormData({
      phone: '',
      telegramApiId: '',
      telegramApiHash: '',
      code: '',
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!connectingPlatform) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/messaging/personal/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: connectingPlatform,
          phone: formData.phone,
          telegramApiId: formData.telegramApiId,
          telegramApiHash: formData.telegramApiHash,
          code: formData.code || undefined,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Проверяем, требуется ли код подтверждения
        if (data.requiresCode || data.codeSent || data.codeAlreadySent || data.message?.includes('verification code') || data.message?.includes('Send verification code')) {
          setWaitingForCode(true)
          if (data.codeSent) {
            setSuccess('Код отправлен. Введите код подтверждения.')
          } else if (data.codeAlreadySent) {
            setSuccess('Введите код подтверждения, который был отправлен ранее.')
          } else {
            setSuccess('Введите код подтверждения.')
          }
        } else if (data.message?.includes('successfully') || data.message?.includes('успешно') || data.message?.includes('connected')) {
          setSuccess('Аккаунт успешно подключен')
          setConnectingPlatform(null)
          setWaitingForCode(false)
          await fetchAccounts()
          setTimeout(() => setSuccess(''), 3000)
        } else {
          // Если не понятно, что делать, показываем сообщение от сервера
          setSuccess(data.message || 'Запрос обработан')
          if (!data.requiresCode && !data.codeSent && !data.codeAlreadySent) {
            setConnectingPlatform(null)
            setWaitingForCode(false)
            await fetchAccounts()
            setTimeout(() => setSuccess(''), 3000)
          }
        }
      } else {
        const data = await response.json()
        setError(data.error || 'Ошибка при подключении')
      }
    } catch (error: any) {
      setError(error.message || 'Ошибка при подключении')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="glass-panel rounded-3xl p-6">
          <div className="text-center py-4 text-[var(--muted)]">Загрузка...</div>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="glass-panel rounded-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Мои мессенджеры</h2>
            <p className="text-sm text-[var(--muted)]">
              Подключите свой личный Telegram или WhatsApp для синхронизации переписки
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">
            {success}
          </div>
        )}

        <div className="space-y-4">
          {/* Telegram */}
          <div className="border border-[var(--border)] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl">
                  📱
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">Telegram</h3>
                  <p className="text-sm text-[var(--muted)]">
                    {accounts.find(a => a.platform === 'TELEGRAM')?.isActive 
                      ? '✅ Подключен' 
                      : 'Не подключен'}
                  </p>
                </div>
              </div>
              {!connectingPlatform && (
                <button
                  onClick={() => handleConnect('TELEGRAM')}
                  className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors text-sm"
                >
                  {accounts.find(a => a.platform === 'TELEGRAM') ? 'Изменить' : 'Подключить'}
                </button>
              )}
            </div>

            {connectingPlatform === 'TELEGRAM' && (
              <form onSubmit={handleSubmit} className="mt-4 space-y-4 pt-4 border-t border-[var(--border)]">
                {/* Инструкция по получению API данных */}
                {!waitingForCode && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                    <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                      📋 Как получить API ID и API Hash:
                    </h4>
                    <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                      <li>Перейдите на <a href="https://my.telegram.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">my.telegram.org</a></li>
                      <li>Войдите в свой аккаунт Telegram (введите номер телефона и код подтверждения)</li>
                      <li>Перейдите в раздел <strong>"API development tools"</strong> (или сразу на <a href="https://my.telegram.org/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">my.telegram.org/apps</a>)</li>
                      <li><strong className="text-red-600">ВАЖНО:</strong> Сначала проверьте, есть ли у вас уже созданное приложение. Если на странице уже отображаются поля <strong>api_id</strong> и <strong>api_hash</strong> - используйте их, создавать новое не нужно!</li>
                      <li>Если приложения нет, заполните форму создания (все поля обязательны):
                        <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                          <li><strong>App title:</strong> полное описательное название с пробелами (например, "My CRM Application" или "Business CRM System") - <span className="text-red-600 font-semibold">минимум 2-3 слова, не используйте одно слово!</span></li>
                          <li><strong>Short name:</strong> короткое название БЕЗ пробелов, только латиница и цифры, 5-32 символа (например, "mycrm" или "crmapp123")</li>
                          <li><strong>URL:</strong> укажите любой валидный URL (например, "https://example.com" или "https://yourcompany.com")</li>
                          <li><strong>Platform:</strong> выберите <strong>"Other (specify in description)"</strong></li>
                          <li><strong>Description:</strong> описание на английском (например, "CRM integration application for business management")</li>
                        </ul>
                      </li>
                      <li>После успешного создания (или если приложение уже было) вы увидите на странице:
                        <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                          <li><strong>api_id</strong> - число (например, 12345678)</li>
                          <li><strong>api_hash</strong> - длинная строка символов (например, abc123def456...)</li>
                        </ul>
                      </li>
                      <li>Скопируйте эти значения в поля ниже</li>
                    </ol>
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-xs text-yellow-800">
                        <strong>Если возникают ошибки:</strong> Telegram обычно позволяет создать только одно приложение на аккаунт. 
                        Если вы видите ошибку при создании, возможно приложение уже существует - обновите страницу и проверьте, не отображаются ли уже api_id и api_hash.
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    Номер телефона
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+79991234567"
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                    required={!waitingForCode}
                    disabled={waitingForCode}
                  />
                  <p className="text-xs text-[var(--muted)] mt-1">Номер должен быть в международном формате с +</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    API ID <span className="text-[var(--muted)] text-xs">(число, например: 12345678)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.telegramApiId}
                    onChange={(e) => setFormData({ ...formData, telegramApiId: e.target.value })}
                    placeholder="12345678"
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                    required={!waitingForCode}
                    disabled={waitingForCode}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    API Hash <span className="text-[var(--muted)] text-xs">(строка, например: abc123def456...)</span>
                  </label>
                  <input
                    type="password"
                    value={formData.telegramApiHash}
                    onChange={(e) => setFormData({ ...formData, telegramApiHash: e.target.value })}
                    placeholder="Вставьте API Hash"
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                    required={!waitingForCode}
                    disabled={waitingForCode}
                  />
                </div>

                {waitingForCode && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                      Код подтверждения
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="Введите код из Telegram"
                      className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                      required
                    />
                    <p className="text-xs text-[var(--muted)] mt-1">Код придет в Telegram на указанный номер телефона</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConnectingPlatform(null)
                      setWaitingForCode(false)
                      setFormData({ phone: '', telegramApiId: '', telegramApiHash: '', code: '' })
                    }}
                    className="flex-1 px-4 py-2 border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-[var(--background-soft)] transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? 'Подключение...' : waitingForCode ? 'Подтвердить' : 'Отправить код'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* WhatsApp */}
          <div className="border border-[var(--border)] rounded-xl p-4 opacity-60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-xl">
                  💬
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">WhatsApp</h3>
                  <p className="text-sm text-[var(--muted)]">Скоро будет доступно</p>
                </div>
              </div>
              <button
                disabled
                className="px-4 py-2 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed text-sm"
              >
                Скоро
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}



