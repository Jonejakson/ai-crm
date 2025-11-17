'use client'

import { useState, useEffect } from 'react'
import UserFilter from '@/components/UserFilter'
import PipelineStagesEditor from '@/components/PipelineStagesEditor'
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import {
  sortableKeyboardCoordinates,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
  user?: {
    id: number
    name: string
    email: string
  }
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
  phone?: string | null
  company?: string | null
}

// Новые дефолтные этапы
const DEFAULT_STAGES = [
  'Первичный контакт',
  'Коммерческое предложение',
  'Согласование',
  'Передача в производство',
  'Скомплектовано на Складе',
  'Закрыто и реализованное',
  'Закрыто пропала потребность'
]

// Колонка для неразобранных сделок (всегда существует, не удаляется)
const UNASSIGNED_STAGE = 'Неразобранные'

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isStagesEditorOpen, setIsStagesEditorOpen] = useState(false)
  const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false)
  const [contactSearch, setContactSearch] = useState('')
  const [selectedPipeline, setSelectedPipeline] = useState<number | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)
  const [newContactData, setNewContactData] = useState({
    name: '',
    email: '',
    phone: '',
    company: ''
  })
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    currency: 'RUB',
    contactId: '',
    stage: '',
    probability: '0',
    expectedCloseDate: '',
    pipelineId: ''
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

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
      
      let dealsData = Array.isArray(dealsRes) ? dealsRes : []
      const pipelinesData = Array.isArray(pipelinesRes) ? pipelinesRes : []
      const contactsData = Array.isArray(contactsRes) ? contactsRes : []
      
      // Устанавливаем дефолтную воронку
      if (pipelinesData.length > 0) {
        const defaultPipeline = pipelinesData.find((p: Pipeline) => p.isDefault) || pipelinesData[0]
        if (defaultPipeline) {
          setSelectedPipeline(defaultPipeline.id)
          const pipelineStages = getStagesFromPipeline(defaultPipeline)
          
          // Перемещаем сделки с несуществующими этапами в "Неразобранные"
          const validStages = [...pipelineStages, UNASSIGNED_STAGE]
          const dealsToUpdate: Promise<void>[] = []
          
          dealsData.forEach((deal: Deal) => {
            // Проверяем, что этап не существует в текущих этапах воронки
            if (!validStages.includes(deal.stage)) {
              // Этап не существует, перемещаем в "Неразобранные"
              console.log(`Moving deal ${deal.id} from stage "${deal.stage}" to "${UNASSIGNED_STAGE}"`)
              dealsToUpdate.push(
                fetch('/api/deals', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    id: deal.id,
                    title: deal.title,
                    amount: deal.amount,
                    currency: deal.currency,
                    stage: UNASSIGNED_STAGE,
                    probability: deal.probability,
                    expectedCloseDate: deal.expectedCloseDate,
                    pipelineId: deal.pipeline?.id || defaultPipeline.id,
                  }),
                }).then((res) => {
                  if (res.ok) {
                    console.log(`Successfully moved deal ${deal.id} to unassigned`)
                    deal.stage = UNASSIGNED_STAGE
                  } else {
                    console.error(`Failed to move deal ${deal.id}:`, res.status, res.statusText)
                    return res.json().then(err => {
                      console.error('Error details:', err)
                    })
                  }
                }).catch(err => {
                  console.error('Error moving deal to unassigned:', err)
                })
              )
            }
          })
          
          // Ждем обновления всех сделок
          if (dealsToUpdate.length > 0) {
            await Promise.all(dealsToUpdate)
            // Перезагружаем данные после обновления
            const updatedDealsRes = await fetch(dealsUrl).then(res => res.ok ? res.json() : [])
            dealsData = Array.isArray(updatedDealsRes) ? updatedDealsRes : []
          }
          
          const stages = [...pipelineStages, UNASSIGNED_STAGE]
          if (stages.length > 0 && !formData.stage) {
            setFormData(prev => ({ ...prev, stage: stages[0] }))
          }
        }
      }
      
      setDeals(dealsData)
      setPipelines(pipelinesData)
      setContacts(contactsData)
    } catch (error) {
      console.error('Error fetching data:', error)
      setDeals([])
      setPipelines([])
      setContacts([])
    } finally {
      setLoading(false)
    }
  }

  // Создаем дефолтную воронку при первом запуске или обновляем существующую
  useEffect(() => {
    const setupPipeline = async () => {
      if (pipelines.length === 0 && !loading) {
        // Создаем новую воронку
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
      } else if (pipelines.length > 0 && !loading && selectedPipeline) {
        // Обновляем существующую воронку, если в ней старые этапы на английском
        const pipeline = pipelines.find(p => p.id === selectedPipeline)
        if (pipeline) {
          const currentStages = getStagesFromPipeline(pipeline)
          const oldEnglishStages = ['lead', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
          const hasOldStages = currentStages.some(stage => oldEnglishStages.includes(stage))
          
          if (hasOldStages) {
            // Обновляем этапы на русские
            try {
              const response = await fetch('/api/pipelines', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: selectedPipeline,
                  stages: DEFAULT_STAGES,
                })
              })
              if (response.ok) {
                await fetchData()
              }
            } catch (error) {
              console.error('Error updating pipeline stages:', error)
            }
          }
        }
      }
    }
    
    if (!loading) {
      setupPipeline()
    }
  }, [loading, pipelines.length, selectedPipeline])

  const getStagesFromPipeline = (pipeline: Pipeline): string[] => {
    try {
      return JSON.parse(pipeline.stages)
    } catch {
      return DEFAULT_STAGES
    }
  }

  const getStages = (): string[] => {
    let stages: string[] = []
    if (selectedPipeline) {
      const pipeline = pipelines.find(p => p.id === selectedPipeline)
      if (pipeline) {
        stages = getStagesFromPipeline(pipeline)
      } else {
        stages = DEFAULT_STAGES
      }
    } else {
      stages = DEFAULT_STAGES
    }
    
    // Всегда добавляем "Неразобранные" в конец, если его еще нет
    if (!stages.includes(UNASSIGNED_STAGE)) {
      stages.push(UNASSIGNED_STAGE)
    }
    
    return stages
  }

  const resetFormState = () => {
    const stages = getStages()
    setFormData({
      title: '',
      amount: '',
      currency: 'RUB',
      contactId: '',
      stage: stages[0] || '',
      probability: '0',
      expectedCloseDate: '',
      pipelineId: ''
    })
    setContactSearch('')
    setEditingDeal(null)
  }

  const findLastIndex = <T,>(array: T[], predicate: (value: T, index: number) => boolean) => {
    for (let i = array.length - 1; i >= 0; i--) {
      if (predicate(array[i], i)) {
        return i
      }
    }
    return -1
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingDeal) {
      await updateDeal(editingDeal.id)
    } else {
      await createDeal()
    }
  }

  const createDeal = async () => {
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
        resetFormState()
      }
    } catch (error) {
      console.error('Error creating deal:', error)
    }
  }

  const updateDeal = async (dealId: number) => {
    try {
      const response = await fetch('/api/deals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: dealId,
          title: formData.title,
          amount: parseFloat(formData.amount) || 0,
          currency: formData.currency,
          stage: formData.stage,
          probability: parseInt(formData.probability) || 0,
          expectedCloseDate: formData.expectedCloseDate || null,
          pipelineId: formData.pipelineId ? Number(formData.pipelineId) : selectedPipeline,
        }),
      })

      if (response.ok) {
        await fetchData()
        setIsModalOpen(false)
        resetFormState()
      } else {
        const error = await response.json()
        alert(error.error || 'Не удалось обновить сделку')
      }
    } catch (error) {
      console.error('Error updating deal:', error)
      alert('Ошибка при обновлении сделки')
    }
  }

  const openEditModal = (deal: Deal) => {
    setEditingDeal(deal)
    const expectedDate =
      deal.expectedCloseDate && deal.expectedCloseDate.includes('T')
        ? deal.expectedCloseDate.slice(0, 10)
        : deal.expectedCloseDate || ''

    setFormData({
      title: deal.title,
      amount: deal.amount ? deal.amount.toString() : '',
      currency: deal.currency || 'RUB',
      contactId: deal.contact.id.toString(),
      stage: deal.stage,
      probability: deal.probability !== undefined ? deal.probability.toString() : '0',
      expectedCloseDate: expectedDate,
      pipelineId: deal.pipeline?.id ? deal.pipeline.id.toString() : ''
    })
    setContactSearch(
      deal.contact.email ? `${deal.contact.name} (${deal.contact.email})` : deal.contact.name
    )
    setIsModalOpen(true)
  }

  const handleDealDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    setActiveDeal(null)

    if (!over) {
      return
    }

    const dealId = parseInt(active.id as string)
    const activeDeal = deals.find(d => d.id === dealId)
    if (!activeDeal) {
      console.error('Deal not found:', dealId)
      return
    }

    const overData = over.data?.current as {
      type?: 'deal' | 'stage'
      stage?: string
      dealId?: number
    } | undefined

    let targetStage = activeDeal.stage

    if (overData?.type === 'deal') {
      targetStage = overData.stage || activeDeal.stage
    } else if (overData?.type === 'stage') {
      targetStage = overData.stage || activeDeal.stage
    } else if (typeof over.id === 'string' && stages.includes(over.id)) {
      targetStage = over.id
    }

    const overDealId =
      overData?.type === 'deal' && overData.dealId ? overData.dealId : null

    setDeals((prevDeals) => {
      const withoutActive = prevDeals.filter((d) => d.id !== dealId)
      const updatedDeal = { ...activeDeal, stage: targetStage }

      if (overDealId && overDealId !== dealId) {
        const insertIndex = withoutActive.findIndex((d) => d.id === overDealId)
        if (insertIndex >= 0) {
          withoutActive.splice(insertIndex, 0, updatedDeal)
          return [...withoutActive]
        }
      }

      if (overData?.type === 'stage') {
        const lastIndex = findLastIndex(
          withoutActive,
          (deal) => deal.stage === overData.stage
        )
        if (lastIndex >= 0) {
          withoutActive.splice(lastIndex + 1, 0, updatedDeal)
          return [...withoutActive]
        }
      }

      return [...withoutActive, updatedDeal]
    })

    if (targetStage === activeDeal.stage) {
      // Перетаскивание внутри одного этапа — обновили только порядок
      return
    }

    try {
      const response = await fetch('/api/deals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: dealId,
          title: activeDeal.title,
          amount: activeDeal.amount,
          currency: activeDeal.currency,
          stage: targetStage,
          probability: activeDeal.probability,
          expectedCloseDate: activeDeal.expectedCloseDate,
          pipelineId: activeDeal.pipeline?.id || selectedPipeline,
        }),
      })

      if (!response.ok) {
        await fetchData()
        throw new Error('Failed to update deal')
      }

      await fetchData()
    } catch (error) {
      console.error('Error updating deal:', error)
      await fetchData()
    }
  }

  const handleStagesUpdate = async (newStages: string[]) => {
    if (!selectedPipeline) return

    // Убираем "Неразобранные" из списка перед сохранением (они всегда есть)
    const stagesToSave = newStages.filter(s => s !== UNASSIGNED_STAGE)
    
    // Находим удаленные этапы
    const oldStages = getStages().filter(s => s !== UNASSIGNED_STAGE)
    const removedStages = oldStages.filter(s => !stagesToSave.includes(s))
    
    // Перемещаем сделки из удаленных этапов в "Неразобранные"
    if (removedStages.length > 0) {
      const dealsToMove = deals.filter(d => removedStages.includes(d.stage))
      const updatePromises = dealsToMove.map(deal =>
        fetch('/api/deals', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: deal.id,
            title: deal.title,
            amount: deal.amount,
            currency: deal.currency,
            stage: UNASSIGNED_STAGE,
            probability: deal.probability,
            expectedCloseDate: deal.expectedCloseDate,
            pipelineId: deal.pipeline?.id || selectedPipeline,
          }),
        })
      )
      
      await Promise.all(updatePromises)
    }

    try {
      const response = await fetch('/api/pipelines', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedPipeline,
          stages: stagesToSave,
        }),
      })

      if (response.ok) {
        await fetchData()
        setIsStagesEditorOpen(false)
      }
    } catch (error) {
      console.error('Error updating pipeline stages:', error)
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

  const getStageColor = (stage: string, index: number): string => {
    if (stage === UNASSIGNED_STAGE) {
      return 'bg-gradient-to-b from-[#f6f7fb] to-white border-white/60'
    }

    const gradients = [
      'bg-gradient-to-b from-[#e6f0ff] via-[#edf4ff] to-[#f8fbff] shadow-[0_25px_35px_-25px_rgba(47,111,237,0.55)]',
      'bg-gradient-to-b from-[#f7ecff] via-[#fbf3ff] to-white shadow-[0_25px_35px_-25px_rgba(139,92,246,0.45)]',
      'bg-gradient-to-b from-[#fff3e6] via-[#fff9f1] to-white shadow-[0_25px_35px_-25px_rgba(255,179,71,0.45)]',
      'bg-gradient-to-b from-[#e7fff7] via-[#f4fffb] to-white shadow-[0_25px_30px_-25px_rgba(16,185,129,0.45)]',
      'bg-gradient-to-b from-[#e9f5ff] via-[#f3f9ff] to-white shadow-[0_25px_35px_-25px_rgba(59,130,246,0.35)]',
      'bg-gradient-to-b from-[#fff0f2] via-[#fff7f8] to-white shadow-[0_25px_35px_-25px_rgba(239,68,68,0.35)]',
    ]
    return `${gradients[index % gradients.length]} border-white/70`
  }

  const stages = getStages()
  const dealsByStage = stages.reduce((acc, stage) => {
    acc[stage] = deals.filter(deal => deal.stage === stage)
    return acc
  }, {} as Record<string, Deal[]>)

  const totalAmount = deals.reduce((sum, deal) => sum + deal.amount, 0)
  const wonDeals = deals.filter(d => d.stage === 'Закрыто и реализованное')
  const wonAmount = wonDeals.reduce((sum, deal) => sum + deal.amount, 0)

  if (loading) {
    return <div className="flex justify-center p-8">Загрузка...</div>
  }

  return (
    <div className="space-y-8 relative">
      {/* Заголовок */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
            Управление воронкой
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">Сделки</h1>
          <p className="text-slate-500">
            Отслеживайте динамику процессов, перетаскивайте карточки и контролируйте этапы.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              window.location.href = '/api/export/deals?format=excel'
            }}
            className="btn-secondary flex items-center gap-2"
          >
            <span className="text-lg">⬇️</span>
            Экспорт CSV
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary"
          >
            + Новая сделка
          </button>
        </div>
      </div>

      {/* Фильтр по менеджеру (только для админа) */}
      <UserFilter
        selectedUserId={selectedUserId}
        onUserChange={setSelectedUserId}
      />

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Всего сделок</p>
          <p className="text-4xl font-semibold mt-3">{deals.length}</p>
          <p className="text-xs text-slate-400 mt-2">Активные + архивные</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Общая сумма</p>
          <p className="text-4xl font-semibold text-blue-600 mt-3">
            {totalAmount.toLocaleString('ru-RU')} ₽
          </p>
          <p className="text-xs text-slate-400 mt-2">Все стадии</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Выиграно</p>
          <p className="text-4xl font-semibold text-emerald-500 mt-3">{wonDeals.length}</p>
          <p className="text-xs text-slate-400 mt-2">Количество сделок</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Сумма выигрышей</p>
          <p className="text-4xl font-semibold text-emerald-500 mt-3">
            {wonAmount.toLocaleString('ru-RU')} ₽
          </p>
          <p className="text-xs text-slate-400 mt-2">Закрыто успешно</p>
        </div>
      </div>

      {/* Канбан-доска */}
      <div className="glass-panel p-6 rounded-3xl shadow-xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-[0.35em] text-slate-400">
              Воронка
            </span>
            <select
              value={selectedPipeline || ''}
              onChange={(e) => {
                const pipelineId = Number(e.target.value)
                setSelectedPipeline(pipelineId)
                const pipeline = pipelines.find(p => p.id === pipelineId)
                if (pipeline) {
                  const stages = getStagesFromPipeline(pipeline)
                  setFormData(prev => ({ ...prev, stage: stages[0] || '' }))
                }
              }}
              className="px-4 py-2 rounded-xl border border-[var(--border-soft)] bg-white/80 focus:border-[var(--primary)] focus:ring-0 text-sm"
            >
              {pipelines.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={async () => {
                if (!selectedPipeline) return
                const pipeline = pipelines.find(p => p.id === selectedPipeline)
                if (!pipeline) return
                
                const pipelineStages = getStagesFromPipeline(pipeline)
                const validStages = [...pipelineStages, UNASSIGNED_STAGE]
                
                const dealsToUpdate = deals.filter(deal => !validStages.includes(deal.stage))
                
                if (dealsToUpdate.length === 0) {
                  alert('Все сделки уже в правильных этапах')
                  return
                }
                
                if (!confirm(`Переместить ${dealsToUpdate.length} сделок в "Неразобранные"?`)) {
                  return
                }
                
                const updatePromises = dealsToUpdate.map(deal =>
                  fetch('/api/deals', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      id: deal.id,
                      title: deal.title,
                      amount: deal.amount,
                      currency: deal.currency,
                      stage: UNASSIGNED_STAGE,
                      probability: deal.probability,
                      expectedCloseDate: deal.expectedCloseDate,
                      pipelineId: deal.pipeline?.id || selectedPipeline,
                    }),
                  })
                )
                
                await Promise.all(updatePromises)
                await fetchData()
                alert('Сделки перемещены в "Неразобранные"')
              }}
              className="btn-secondary text-sm"
              title="Переместить сделки с несуществующими этапами в 'Неразобранные'"
            >
              🔄 Найти потерянные сделки
            </button>
            <button
              onClick={() => setIsStagesEditorOpen(true)}
              className="btn-primary text-sm"
            >
              ⚙️ Управление этапами
            </button>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={handleDealDragEnd}
          onDragStart={(event) => {
            const deal = deals.find(d => d.id === parseInt(event.active.id as string))
            setActiveDeal(deal || null)
          }}
          onDragCancel={() => setActiveDeal(null)}
        >
          <div className="overflow-x-auto">
            <div className="flex space-x-4 min-w-max pb-4">
              {stages.map((stage, index) => (
                <DealColumn
                  key={stage}
                  stage={stage}
                  deals={dealsByStage[stage] || []}
                  onDelete={handleDelete}
                  onEdit={openEditModal}
                  color={getStageColor(stage, index)}
                />
              ))}
            </div>
          </div>
          <DragOverlay>
            {activeDeal ? (
              <div className="bg-white rounded-lg p-3 shadow-lg border border-gray-200 w-64">
                <h4 className="font-medium text-gray-900 text-sm">{activeDeal.title}</h4>
                <div className="text-xs text-gray-600 mt-1">{activeDeal.contact.name}</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">
                  {activeDeal.amount.toLocaleString('ru-RU')} {activeDeal.currency}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Модальное окно создания сделки */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Новая сделка</h3>
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  resetFormState()
                }}
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
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={contactSearch}
                        onChange={(e) => {
                          setContactSearch(e.target.value)
                          // Автоматически выбираем клиента если введен точный email или ID
                          const found = contacts.find(c => 
                            c.email.toLowerCase() === e.target.value.toLowerCase() ||
                            c.name.toLowerCase().includes(e.target.value.toLowerCase())
                          )
                          if (found) {
                            setFormData({...formData, contactId: found.id.toString()})
                          }
                        }}
                        onFocus={() => {
                          if (formData.contactId) {
                            const selected = contacts.find(c => c.id.toString() === formData.contactId)
                            if (selected) {
                              setContactSearch(selected.email ? `${selected.name} (${selected.email})` : selected.name)
                            }
                          }
                        }}
                        placeholder="Введите имя или email для поиска..."
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      {contactSearch && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {contacts
                            .filter(contact => 
                              contact.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                              (contact.email && contact.email.toLowerCase().includes(contactSearch.toLowerCase())) ||
                              (contact.company && contact.company.toLowerCase().includes(contactSearch.toLowerCase()))
                            )
                            .slice(0, 10)
                            .map(contact => (
                              <div
                                key={contact.id}
                                onClick={() => {
                                  setFormData({...formData, contactId: contact.id.toString()})
                                  setContactSearch(contact.email ? `${contact.name} (${contact.email})` : contact.name)
                                }}
                                className="p-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              >
                                <div className="font-medium text-gray-900">{contact.name}</div>
                                {contact.email && (
                                  <div className="text-sm text-gray-600">{contact.email}</div>
                                )}
                                {contact.company && (
                                  <div className="text-xs text-gray-500">{contact.company}</div>
                                )}
                              </div>
                            ))}
                          {contacts.filter(contact => 
                            contact.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                            (contact.email && contact.email.toLowerCase().includes(contactSearch.toLowerCase()))
                          ).length === 0 && (
                            <div className="p-2 text-gray-500 text-sm">
                              Клиент не найден
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <input
                      type="hidden"
                      value={formData.contactId}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewContactModalOpen(true)
                        setContactSearch('')
                      }}
                      className="w-full px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      + Создать нового клиента
                    </button>
                  </div>
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
                    required
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Выберите этап</option>
                    {stages.filter(s => s !== UNASSIGNED_STAGE).map(stage => (
                      <option key={stage} value={stage}>{stage}</option>
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
                  onClick={() => {
                    setIsModalOpen(false)
                    resetFormState()
                  }}
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

      {/* Редактор этапов */}
      {isStagesEditorOpen && selectedPipeline && (
        <PipelineStagesEditor
          stages={stages}
          onStagesChange={handleStagesUpdate}
          onClose={() => setIsStagesEditorOpen(false)}
          unassignedStage={UNASSIGNED_STAGE}
        />
      )}

      {/* Модальное окно создания нового клиента */}
      {isNewContactModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Новый клиент</h3>
              <button
                onClick={() => {
                  setIsNewContactModalOpen(false)
                  setNewContactData({ name: '', email: '', phone: '', company: '' })
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                try {
                  const response = await fetch('/api/contacts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newContactData),
                  })

                  if (response.ok) {
                    const newContact = await response.json()
                    // Обновляем список контактов
                    await fetchData()
                    // Выбираем нового клиента в форме сделки
                    setFormData({...formData, contactId: newContact.id.toString()})
                    setContactSearch(newContact.email ? `${newContact.name} (${newContact.email})` : newContact.name)
                    setIsNewContactModalOpen(false)
                    setNewContactData({ name: '', email: '', phone: '', company: '' })
                  } else {
                    const error = await response.json()
                    alert(error.error || 'Ошибка при создании клиента')
                  }
                } catch (error) {
                  console.error('Error creating contact:', error)
                  alert('Ошибка при создании клиента')
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Имя *
                </label>
                <input
                  type="text"
                  value={newContactData.name}
                  onChange={(e) => setNewContactData({...newContactData, name: e.target.value})}
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newContactData.email}
                  onChange={(e) => setNewContactData({...newContactData, email: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Телефон
                </label>
                <input
                  type="tel"
                  value={newContactData.phone}
                  onChange={(e) => setNewContactData({...newContactData, phone: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Компания
                </label>
                <input
                  type="text"
                  value={newContactData.company}
                  onChange={(e) => setNewContactData({...newContactData, company: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewContactModalOpen(false)
                    setNewContactData({ name: '', email: '', phone: '', company: '' })
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Создать клиента
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Компонент колонки с drag & drop для сделок
function DealColumn({
  stage,
  deals,
  onDelete,
  onEdit,
  color,
}: {
  stage: string
  deals: Deal[]
  onDelete: (id: number) => void
  onEdit: (deal: Deal) => void
  color: string
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
    data: {
      type: 'stage',
      stage,
    },
  })

  const items = deals.map((deal) => deal.id.toString())

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column flex-shrink-0 w-72 ${color} ${
        isOver ? 'ring-2 ring-[var(--primary)]/40' : 'ring-0'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Этап
          </p>
          <h3 className="font-semibold text-slate-800 text-lg">
            {stage}
          </h3>
        </div>
        <span className="text-sm font-semibold text-slate-500">
          {deals.length}
        </span>
      </div>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="space-y-3 min-h-[120px]">
          {deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

// Компонент карточки сделки с drag & drop
function DealCard({
  deal,
  onDelete,
  onEdit,
}: {
  deal: Deal
  onDelete: (id: number) => void
  onEdit: (deal: Deal) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: deal.id.toString(),
    data: {
      type: 'deal',
      dealId: deal.id,
      stage: deal.stage,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="group relative overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur cursor-grab active:cursor-grabbing transition-all hover:shadow-2xl"
    >
      <div className="absolute inset-x-4 top-2 h-1 rounded-full bg-[var(--primary-soft)] group-hover:bg-[var(--primary)]/30 transition-colors" />
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium text-gray-900 text-sm flex-1 pr-2">{deal.title}</h4>
        <div className="flex items-center space-x-1 ml-2 text-xs">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(deal)
            }}
            className="text-blue-500 hover:text-blue-700"
            title="Редактировать сделку"
          >
            ✎
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(deal.id)
            }}
            className="text-red-500 hover:text-red-700"
            title="Удалить сделку"
          >
            ×
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-600 mb-2">
        <a
          href={`/contacts/${deal.contact.id}`}
          className="text-blue-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {deal.contact.name}
        </a>
      </div>
      <div className="text-lg font-semibold text-gray-900 mb-2">
        {deal.amount.toLocaleString('ru-RU')} {deal.currency}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Вероятность: {deal.probability}%</span>
        {deal.user && (
          <span className="text-gray-400">{deal.user.name}</span>
        )}
      </div>
    </div>
  )
}
