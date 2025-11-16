'use client'

import { useState, useEffect } from 'react'
import UserFilter from '@/components/UserFilter'

interface Deal {
  id: number
  title: string
  amount: number
  currency: string
  stage: string
  probability: number
  expectedCloseDate: string | null
  contact: {
    id: number
    name: string
    email: string
    company: string | null
  }
  pipeline: {
    id: number
    name: string
  } | null
}

interface Pipeline {
  id: number
  name: string
  stages: string
  isDefault: boolean
}

interface Contact {
  id: number
  name: string
  email: string
}

const DEFAULT_STAGES = ['lead', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPipeline, setSelectedPipeline] = useState<number | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    currency: 'RUB',
    contactId: '',
    stage: 'lead',
    probability: '0',
    expectedCloseDate: '',
    pipelineId: ''
  })

  useEffect(() => {
    fetchData()
  }, [selectedUserId])

  const fetchData = async () => {
    try {
      const dealsUrl = selectedUserId 
        ? `/api/deals?userId=${selectedUserId}` 
        : '/api/deals'
      const contactsUrl = selectedUserId 
        ? `/api/contacts?userId=${selectedUserId}` 
        : '/api/contacts'
      
      const [dealsRes, pipelinesRes, contactsRes] = await Promise.all([
        fetch(dealsUrl).then(res => res.ok ? res.json() : []),
        fetch('/api/pipelines').then(res => res.ok ? res.json() : []),
        fetch(contactsUrl).then(res => res.ok ? res.json() : [])
      ])
      
      const dealsData = Array.isArray(dealsRes) ? dealsRes : []
      const pipelinesData = Array.isArray(pipelinesRes) ? pipelinesRes : []
      const contactsData = Array.isArray(contactsRes) ? contactsRes : []
      
      setDeals(dealsData)
      setPipelines(pipelinesData)
      setContacts(contactsData)
      
      // Устанавливаем дефолтную воронку
      if (pipelinesData.length > 0) {
        const defaultPipeline = pipelinesData.find((p: Pipeline) => p.isDefault) || pipelinesData[0]
        if (defaultPipeline) {
          setSelectedPipeline(defaultPipeline.id)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      setDeals([])
      setPipelines([])
      setContacts([])
    } finally {
      setLoading(false)
    }
  }

  // Создаем дефолтную воронку при первом запуске
  useEffect(() => {
    const createDefaultPipeline = async () => {
      if (pipelines.length === 0) {
        try {
          const response = await fetch('/api/pipelines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'Основная воронка',
              stages: JSON.stringify(DEFAULT_STAGES),
              isDefault: true
            })
          })
          if (response.ok) {
            await fetchData()
          }
        } catch (error) {
          console.error('Error creating default pipeline:', error)
        }
      }
    }
    
    if (!loading && pipelines.length === 0) {
      createDefaultPipeline()
    }
  }, [loading, pipelines.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          contactId: Number(formData.contactId),
          amount: parseFloat(formData.amount) || 0,
          probability: parseInt(formData.probability) || 0,
          pipelineId: formData.pipelineId ? Number(formData.pipelineId) : selectedPipeline,
        }),
      })

      if (response.ok) {
        await fetchData()
        setIsModalOpen(false)
        setFormData({
          title: '',
          amount: '',
          currency: 'RUB',
          contactId: '',
          stage: 'lead',
          probability: '0',
          expectedCloseDate: '',
          pipelineId: ''
        })
      }
    } catch (error) {
      console.error('Error creating deal:', error)
    }
  }

  const handleStageChange = async (dealId: number, newStage: string) => {
    try {
      const deal = deals.find(d => d.id === dealId)
      if (!deal) return

      const response = await fetch('/api/deals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: dealId,
          title: deal.title,
          amount: deal.amount,
          currency: deal.currency,
          stage: newStage,
          probability: deal.probability,
          expectedCloseDate: deal.expectedCloseDate,
          pipelineId: deal.pipeline?.id || selectedPipeline,
        }),
      })

      if (response.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Error updating deal:', error)
    }
  }

  const handleDelete = async (dealId: number) => {
    if (!confirm('Удалить сделку?')) return

    try {
      const response = await fetch(`/api/deals?id=${dealId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Error deleting deal:', error)
    }
  }

  const getStages = (): string[] => {
    if (selectedPipeline) {
      const pipeline = pipelines.find(p => p.id === selectedPipeline)
      if (pipeline) {
        try {
          return JSON.parse(pipeline.stages)
        } catch {
          return DEFAULT_STAGES
        }
      }
    }
    return DEFAULT_STAGES
  }

  const getStageName = (stage: string): string => {
    const names: Record<string, string> = {
      lead: 'Лид',
      qualification: 'Квалификация',
      proposal: 'Предложение',
      negotiation: 'Переговоры',
      closed_won: 'Закрыта (Успех)',
      closed_lost: 'Закрыта (Провал)',
    }
    return names[stage] || stage
  }

  const getStageColor = (stage: string): string => {
    const colors: Record<string, string> = {
      lead: 'bg-blue-100 border-blue-300',
      qualification: 'bg-yellow-100 border-yellow-300',
      proposal: 'bg-purple-100 border-purple-300',
      negotiation: 'bg-orange-100 border-orange-300',
      closed_won: 'bg-green-100 border-green-300',
      closed_lost: 'bg-red-100 border-red-300',
    }
    return colors[stage] || 'bg-gray-100 border-gray-300'
  }

  const stages = getStages()
  const dealsByStage = stages.reduce((acc, stage) => {
    acc[stage] = deals.filter(deal => deal.stage === stage)
    return acc
  }, {} as Record<string, Deal[]>)

  const totalAmount = deals.reduce((sum, deal) => sum + deal.amount, 0)
  const wonDeals = deals.filter(d => d.stage === 'closed_won')
  const wonAmount = wonDeals.reduce((sum, deal) => sum + deal.amount, 0)

  if (loading) {
    return <div className="flex justify-center p-8">Загрузка...</div>
  }

  return (
    <div className="space-y-6">
      {/* Заголовок и статистика */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Сделки</h1>
      </div>
      
      {/* Фильтр по менеджеру (только для админа) */}
      <UserFilter 
        selectedUserId={selectedUserId} 
        onUserChange={setSelectedUserId} 
      />
      
      <div className="flex justify-end">
        <div className="flex space-x-2">
          <button 
            onClick={() => {
              window.location.href = '/api/export/deals?format=excel'
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
          >
            <span>📥</span>
            <span>Экспорт CSV</span>
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            + Новая сделка
          </button>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500">Всего сделок</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">{deals.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500">Общая сумма</h3>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {totalAmount.toLocaleString('ru-RU')} ₽
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500">Выиграно</h3>
          <p className="text-2xl font-bold text-green-600 mt-1">{wonDeals.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500">Сумма выигрышей</h3>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {wonAmount.toLocaleString('ru-RU')} ₽
          </p>
        </div>
      </div>

      {/* Канбан-доска */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mr-2">Воронка:</label>
          <select
            value={selectedPipeline || ''}
            onChange={(e) => setSelectedPipeline(Number(e.target.value))}
            className="px-3 py-1 border border-gray-300 rounded-lg"
          >
            {pipelines.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <div className="flex space-x-4 min-w-max">
            {stages.map((stage) => (
              <div
                key={stage}
                className={`flex-shrink-0 w-64 ${getStageColor(stage)} rounded-lg p-3 border-2`}
              >
                <h3 className="font-semibold text-gray-900 mb-3">
                  {getStageName(stage)} ({dealsByStage[stage]?.length || 0})
                </h3>
                <div className="space-y-2">
                  {dealsByStage[stage]?.map((deal) => (
                    <div
                      key={deal.id}
                      className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900 text-sm">{deal.title}</h4>
                        <button
                          onClick={() => handleDelete(deal.id)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          ×
                        </button>
                      </div>
                      <div className="text-xs text-gray-600 mb-2">
                        <a
                          href={`/contacts/${deal.contact.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {deal.contact.name}
                        </a>
                      </div>
                      <div className="text-sm font-semibold text-gray-900 mb-2">
                        {deal.amount.toLocaleString('ru-RU')} {deal.currency}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">
                          Вероятность: {deal.probability}%
                        </span>
                        <select
                          value={deal.stage}
                          onChange={(e) => handleStageChange(deal.id, e.target.value)}
                          className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                        >
                          {stages.map(s => (
                            <option key={s} value={s}>{getStageName(s)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Модальное окно создания сделки */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Новая сделка</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Название сделки *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Клиент *
                  </label>
                  <select
                    value={formData.contactId}
                    onChange={(e) => setFormData({...formData, contactId: e.target.value})}
                    required
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Выберите клиента</option>
                    {contacts.map(contact => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name} ({contact.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Сумма
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Валюта
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({...formData, currency: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="RUB">RUB</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Вероятность (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.probability}
                    onChange={(e) => setFormData({...formData, probability: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Этап
                  </label>
                  <select
                    value={formData.stage}
                    onChange={(e) => setFormData({...formData, stage: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {stages.map(stage => (
                      <option key={stage} value={stage}>{getStageName(stage)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ожидаемая дата закрытия
                  </label>
                  <input
                    type="date"
                    value={formData.expectedCloseDate}
                    onChange={(e) => setFormData({...formData, expectedCloseDate: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Создать сделку
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

