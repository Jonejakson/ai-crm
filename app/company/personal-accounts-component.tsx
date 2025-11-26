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
        setAccounts(data)
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
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
        if (data.message?.includes('verification code')) {
          setWaitingForCode(true)
          setSuccess('Код отправлен. Введите код подтверждения.')
        } else {
          setSuccess('Аккаунт успешно подключен')
          setConnectingPlatform(null)
          await fetchAccounts()
          setTimeout(() => setSuccess(''), 3000)
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
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    API ID
                  </label>
                  <input
                    type="text"
                    value={formData.telegramApiId}
                    onChange={(e) => setFormData({ ...formData, telegramApiId: e.target.value })}
                    placeholder="Получите на https://my.telegram.org"
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                    required={!waitingForCode}
                    disabled={waitingForCode}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    API Hash
                  </label>
                  <input
                    type="password"
                    value={formData.telegramApiHash}
                    onChange={(e) => setFormData({ ...formData, telegramApiHash: e.target.value })}
                    placeholder="Получите на https://my.telegram.org"
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

                <p className="text-xs text-[var(--muted)]">
                  📌 Получите API ID и Hash на{' '}
                  <a href="https://my.telegram.org" target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">
                    my.telegram.org
                  </a>
                </p>
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


