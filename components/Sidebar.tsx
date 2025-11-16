'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { getActiveSection } from '@/lib/utils'

interface SidebarProps {
  currentContactId?: number;
}

export default function Sidebar({ currentContactId }: SidebarProps) {
  const [isAIOpen, setIsAIOpen] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { data: session } = useSession()
  
  const pathname = usePathname()
  const activeSection = getActiveSection(pathname)
  const isAdmin = session?.user?.role === 'admin'

const handleAISubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!aiMessage.trim()) return

  setIsLoading(true)
  
  try {
    const response = await fetch('/api/ai/assistant', {  // ← ИЗМЕНИЛ URL
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: aiMessage,
        contactId: currentContactId
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.error) {
      throw new Error(data.error)
    }

    setAiResponse(data.response || 'Ответ от AI')
  } catch (error) {
    console.error('Error calling AI:', error)
    setAiResponse('Ошибка соединения. Проверьте консоль для деталей.')
  } finally {
    setIsLoading(false)
  }
}

  const menuItems = [
    { id: 'dashboard', name: 'Дашборд', href: '/', icon: '📊' },
    { id: 'deals', name: 'Сделки', href: '/deals', icon: '💰' },
    { id: 'contacts', name: 'Клиенты', href: '/contacts', icon: '👥' },
    { id: 'tasks', name: 'Задачи', href: '/tasks', icon: '✅' },
    { id: 'calendar', name: 'Календарь', href: '/calendar', icon: '📅' },
    { id: 'analytics', name: 'Аналитика', href: '/analytics', icon: '📈' },
    { id: 'dialogs', name: 'Диалоги', href: '/dialogs', icon: '💬' },
    // Показываем "Компания" только для админов
    ...(isAdmin ? [{ id: 'company', name: 'Компания', href: '/company', icon: '🏢' }] : []),
  ]

  const quickQuestions = [
    'Какие клиенты требуют внимания?',
    'Какие ближайшие задачи?',
    'Покажи статистику по сделкам',
    'Какие активные сделки?',
    'Покажи общую статистику',
    'Кому нужно отправить сообщение?'
  ]

  // Если есть currentContactId, добавляем вопросы про конкретного клиента
  const clientSpecificQuestions = currentContactId ? [
    'Что известно об этом клиенте?',
    'Какие задачи у этого клиента?',
    'История общения с клиентом',
    'Что предложить этому клиенту?'
  ] : []

  const allQuickQuestions = [...quickQuestions, ...clientSpecificQuestions]

  return (
    <>
      {/* Сайдбар */}
      <div className="hidden md:flex w-64 bg-gradient-to-b from-gray-900 to-gray-800 text-white min-h-screen p-4 flex-col shadow-xl border-r border-gray-700">
        {/* Логотип */}
        <div className="mb-8 p-4 animate-fadeIn">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            CRM System
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {currentContactId ? 'Режим клиента' : 'Управление клиентами'}
          </p>
        </div>

        {/* Навигация */}
        <nav className="space-y-1.5 flex-1">
          {menuItems.map((item, index) => {
            const isActive = activeSection === item.id
            return (
              <a
                key={item.id}
                href={item.href}
                className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30' 
                    : 'hover:bg-gray-800/50 hover:translate-x-1'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium">{item.name}</span>
                {isActive && (
                  <span className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse-slow"></span>
                )}
              </a>
            )
          })}
        </nav>

        {/* Информация о текущем клиенте */}
        {currentContactId && (
          <div className="mt-4 p-3 bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-300">
              👁️ Режим просмотра клиента
            </p>
            <p className="text-xs text-gray-400 mt-1">
              AI видит данные этого клиента
            </p>
          </div>
        )}

        {/* AI Ассистент кнопка */}
        <div className="pt-8 border-t border-gray-700">
          <button
            onClick={() => {
              setIsAIOpen(true)
              setAiResponse('')
            }}
            className="w-full flex items-center space-x-3 p-3 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <span className="text-lg">🤖</span>
            <span>AI Ассистент</span>
            {currentContactId && (
              <span className="text-xs bg-blue-500 px-2 py-1 rounded-full">
                Контекст
              </span>
            )}
          </button>
        </div>
      </div>

      {/* AI Ассистент модальное окно */}
      {isAIOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold">AI Ассистент CRM</h3>
                {currentContactId && (
                  <p className="text-sm text-gray-600">
                    💡 Режим с контекстом клиента
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsAIOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            {/* Быстрые вопросы */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Быстрые вопросы:</p>
              <div className="flex flex-wrap gap-2">
                {allQuickQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => setAiMessage(question)}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>

            {/* Форма вопроса */}
            <form onSubmit={handleAISubmit} className="mb-4">
              <div className="flex space-x-3">
                <input
                  value={aiMessage}
                  onChange={(e) => setAiMessage(e.target.value)}
                  placeholder={
                    currentContactId 
                      ? "Спросите о текущем клиенте, например: 'Какие задачи у этого клиента?'"
                      : "Например: 'Какие клиенты требуют внимания?' или 'Какие ближайшие задачи?'"
                  }
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? '...' : '➤'}
                </button>
              </div>
            </form>

            {/* Ответ AI */}
            {aiResponse && (
              <div className="flex-1 overflow-y-auto">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <span className="text-lg mr-2">🤖</span>
                    <span className="font-semibold text-blue-900">AI Ассистент:</span>
                  </div>
                  <p className="text-blue-800 whitespace-pre-wrap">{aiResponse}</p>
                </div>
              </div>
            )}

            {/* Информация о контексте */}
            {currentContactId && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  💡 AI видит полную информацию о текущем клиенте: контактные данные, задачи, историю диалогов
                </p>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  )
}