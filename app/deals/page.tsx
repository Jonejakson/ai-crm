'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useSession } from 'next-auth/react'
import { useKeyboardShortcuts } from '@/lib/keyboard-shortcuts'
import PipelineStagesEditor from '@/components/PipelineStagesEditor'
import PipelineManager from '@/components/PipelineManager'
import Comments from '@/components/Comments'
import TagsManager from '@/components/TagsManager'
import CustomFieldsEditor from '@/components/CustomFieldsEditor'
import FiltersModal from '@/components/FiltersModal'
import FilesManager from '@/components/FilesManager'
import Skeleton, { SkeletonKanban } from '@/components/Skeleton'
import type { CollisionDetection } from '@dnd-kit/core'
import ExportButton from '@/components/ExportButton'
import {
  DndContext,
  pointerWithin,
  rectIntersection,
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
  createdAt?: string
  updatedAt?: string
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

interface Stage {
  name: string
  color: string
}

interface Pipeline {
  id: number
  name: string
  stages: string // JSON массив Stage[]
  isDefault: boolean
}

interface Contact {
  id: number
  name: string
  email: string
  phone?: string | null
  company?: string | null
}

// Палитра цветов (должна совпадать с PipelineStagesEditor)
const COLOR_PALETTE = [
  { name: 'Синий', value: 'bg-gradient-to-b from-[#e6f0ff] via-[#edf4ff] to-[#f8fbff]', shadow: 'shadow-[0_25px_35px_-25px_rgba(47,111,237,0.55)]' },
  { name: 'Фиолетовый', value: 'bg-gradient-to-b from-[#f7ecff] via-[#fbf3ff] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(139,92,246,0.45)]' },
  { name: 'Оранжевый', value: 'bg-gradient-to-b from-[#fff3e6] via-[#fff9f1] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(255,179,71,0.45)]' },
  { name: 'Зеленый', value: 'bg-gradient-to-b from-[#e7fff7] via-[#f4fffb] to-white', shadow: 'shadow-[0_25px_30px_-25px_rgba(16,185,129,0.45)]' },
  { name: 'Голубой', value: 'bg-gradient-to-b from-[#e9f5ff] via-[#f3f9ff] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(59,130,246,0.35)]' },
  { name: 'Розовый', value: 'bg-gradient-to-b from-[#fff0f2] via-[#fff7f8] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(239,68,68,0.35)]' },
  { name: 'Желтый', value: 'bg-gradient-to-b from-[#fffbeb] via-[#fef9c3] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(234,179,8,0.35)]' },
  { name: 'Бирюзовый', value: 'bg-gradient-to-b from-[#ecfeff] via-[#cffafe] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(6,182,212,0.35)]' },
]

// Новые дефолтные этапы
const DEFAULT_STAGES_NAMES = [
  'Первичный контакт',
  'Коммерческое предложение',
  'Согласование',
  'Передача в производство',
  'Скомплектовано на Складе',
  'Закрыто и реализованное',
  'Закрыто пропала потребность'
]

// Преобразуем имена в объекты Stage с цветами по умолчанию
const DEFAULT_STAGES: Stage[] = DEFAULT_STAGES_NAMES.map((name, index) => ({
  name,
  color: COLOR_PALETTE[index % COLOR_PALETTE.length].value
}))

// Колонка для неразобранных сделок (всегда существует, не удаляется)
const UNASSIGNED_STAGE = 'Неразобранные'

interface User {
  id: number
  name: string
  email: string
  role: string
}

export default function DealsPage() {
  const { data: session } = useSession()
  const [deals, setDeals] = useState<Deal[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isStagesEditorOpen, setIsStagesEditorOpen] = useState(false)
  const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false)
  const [isPipelineManagerOpen, setIsPipelineManagerOpen] = useState(false)
  const [contactSearch, setContactSearch] = useState('')
  const [selectedPipeline, setSelectedPipeline] = useState<number | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)
  const [viewingDeal, setViewingDeal] = useState<Deal | null>(null)
  // Убрали вкладки - все в одной прокручиваемой странице
  const [filters, setFilters] = useState<any>({})
  const [savedFilters, setSavedFilters] = useState<Array<{ id: number; name: string; filters: any }>>([])
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
  const [searchTerm, setSearchTerm] = useState('')
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false)

  const collisionDetectionStrategy: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args)

    if (pointerCollisions.length > 0) {
      const pointer = args.pointerCoordinates

      const stageCollisions = pointerCollisions.filter((collision) => {
        const droppable = args.droppableContainers.find((container) => container.id === collision.id)
        return droppable?.data?.current?.type === 'stage'
      })

      const collisionsToSort = stageCollisions.length > 0 ? stageCollisions : pointerCollisions

      const sorted = collisionsToSort
        .map((collision) => {
          const droppable = args.droppableContainers.find((container) => container.id === collision.id)
          const rect = droppable?.rect.current
          if (!rect || !pointer) {
            return { collision, distance: Number.POSITIVE_INFINITY }
          }
          const centerX = rect.left + rect.width / 2
          const centerY = rect.top + rect.height / 2
          const distance = Math.hypot(pointer.x - centerX, pointer.y - centerY)
          return { collision, distance }
        })
        .sort((a, b) => a.distance - b.distance)
        .map((item) => item.collision)

      return sorted
    }

    return rectIntersection(args)
  }

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

  const handlePipelineChange = async (pipelineId: number) => {
    setSelectedPipeline(pipelineId)
    const pipeline = pipelines.find((p) => p.id === pipelineId)
    if (pipeline) {
      const pipelineStages = getStagesFromPipeline(pipeline)
      const firstStage = pipelineStages[0]
      setFormData(prev => ({ ...prev, stage: firstStage?.name || '' }))
    }
    // Перезагружаем данные с новой воронкой, чтобы показать сделки выбранной воронки
    await fetchData(pipelineId)
  }

  const fetchUsers = async () => {
    if (session?.user?.role !== 'admin') return
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  useEffect(() => {
    fetchData()
    // Загружаем сохраненные фильтры из localStorage
    const saved = localStorage.getItem('savedFilters_deals')
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved))
      } catch (e) {
        console.error('Error loading saved filters:', e)
      }
    }

  }, [selectedUserId, selectedPipeline])

  useEffect(() => {
    fetchUsers()
  }, [session])

  // Клавиатурные сокращения для страницы сделок
  useKeyboardShortcuts([
    {
      key: 'n',
      ctrl: true,
      action: () => setIsModalOpen(true),
      description: 'Создать новую сделку',
    },
  ])

  const fetchData = async (pipelineIdOverride?: number | null) => {
    try {
      // Используем переданный pipelineId или текущий selectedPipeline
      const pipelineIdToUse = pipelineIdOverride !== undefined ? pipelineIdOverride : selectedPipeline
      
      // Формируем URL для загрузки сделок с учетом фильтров
      const dealsParams = new URLSearchParams()
      if (selectedUserId) {
        dealsParams.append('userId', selectedUserId.toString())
      }
      if (pipelineIdToUse) {
        dealsParams.append('pipelineId', pipelineIdToUse.toString())
      }
      const dealsUrl = dealsParams.toString() 
        ? `/api/deals?${dealsParams.toString()}` 
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
          let currentPipelineId = pipelineIdToUse
          if (!currentPipelineId) {
            currentPipelineId = defaultPipeline.id
            if (selectedPipeline !== defaultPipeline.id) {
              setSelectedPipeline(defaultPipeline.id)
            }
          }
          const activePipeline = pipelinesData.find((p: Pipeline) => p.id === currentPipelineId) || defaultPipeline
          const pipelineStages = getStagesFromPipeline(activePipeline)
          
          // Перемещаем сделки с несуществующими этапами в "Неразобранные"
          const validStages = [...pipelineStages.map(s => s.name), UNASSIGNED_STAGE]
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
                    pipelineId: deal.pipeline?.id || activePipeline.id,
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
          
          const stages = [...pipelineStages, { name: UNASSIGNED_STAGE, color: 'bg-gradient-to-b from-[#f6f7fb] to-white' }]
          if (stages.length > 0 && !formData.stage) {
            setFormData(prev => ({ ...prev, stage: stages[0]?.name || '' }))
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
          const hasOldStages = currentStages.some(stage => oldEnglishStages.includes(stage.name))
          
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

  const getStagesFromPipeline = (pipeline: Pipeline): Stage[] => {
    try {
      const parsed = JSON.parse(pipeline.stages)
      // Если это массив строк (старый формат), преобразуем в массив объектов
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof parsed[0] === 'string') {
          return parsed.map((name: string, index: number) => ({
            name,
            color: COLOR_PALETTE[index % COLOR_PALETTE.length].value
          }))
        }
        // Новый формат - массив объектов
        return parsed as Stage[]
      }
      return DEFAULT_STAGES
    } catch {
      return DEFAULT_STAGES
    }
  }

  const getStages = (): Stage[] => {
    let stages: Stage[] = []
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
    if (!stages.some(s => s.name === UNASSIGNED_STAGE)) {
      stages.push({ name: UNASSIGNED_STAGE, color: 'bg-gradient-to-b from-[#f6f7fb] to-white' })
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
      stage: stages[0]?.name || '',
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
        toast.success('Сделка успешно создана')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при создании сделки')
      }
    } catch (error) {
      console.error('Error creating deal:', error)
      toast.error('Ошибка при создании сделки')
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
        toast.success('Сделка успешно обновлена')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Не удалось обновить сделку')
      }
    } catch (error) {
      console.error('Error updating deal:', error)
      toast.error('Ошибка при обновлении сделки')
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

    // Приоритет: сначала проверяем, является ли цель колонкой (stage)
    if (overData?.type === 'stage' && overData.stage) {
      targetStage = overData.stage
    } else if (typeof over.id === 'string' && stages.some(s => s.name === over.id)) {
      // Если ID совпадает с названием этапа
      targetStage = over.id
    } else if (overData?.type === 'deal' && overData.stage) {
      // Если перетащили на карточку, используем этап этой карточки
      targetStage = overData.stage
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

  const handleStagesUpdate = async (newStages: string[] | Stage[]) => {
    if (!selectedPipeline) return

    // Преобразуем в массив Stage, если это строки
    const stagesArray: Stage[] = newStages.map((stage, index) => {
      if (typeof stage === 'string') {
        return {
          name: stage,
          color: COLOR_PALETTE[index % COLOR_PALETTE.length].value
        }
      }
      return stage
    })

    // Убираем "Неразобранные" из списка перед сохранением (они всегда есть)
    const stagesToSave = stagesArray.filter(s => s.name !== UNASSIGNED_STAGE)
    
    // Находим удаленные этапы
    const oldStages = getStages().filter(s => s.name !== UNASSIGNED_STAGE)
    const removedStages = oldStages.filter(s => !stagesToSave.some(newStage => newStage.name === s.name))
    
    // Перемещаем сделки из удаленных этапов в "Неразобранные"
    if (removedStages.length > 0) {
      const removedStageNames = removedStages.map(s => s.name)
      const dealsToMove = deals.filter(d => removedStageNames.includes(d.stage))
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
          stages: JSON.stringify(stagesToSave),
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
        toast.success('Сделка успешно удалена')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Ошибка при удалении сделки')
      }
    } catch (error) {
      console.error('Error deleting deal:', error)
      toast.error('Ошибка при удалении сделки')
    }
  }

  const getStageColor = (stageName: string): string => {
    if (stageName === UNASSIGNED_STAGE) {
      return 'bg-gradient-to-b from-[#f6f7fb] to-white border-white/60'
    }

    const stages = getStages()
    const stage = stages.find(s => s.name === stageName)
    
    if (stage) {
      // Находим соответствующий shadow для цвета
      const colorInfo = COLOR_PALETTE.find(c => c.value === stage.color)
      if (colorInfo) {
        return `${stage.color} ${colorInfo.shadow} border-white/70`
      }
      return `${stage.color} border-white/70`
    }
    
    // Fallback на старый способ, если этап не найден
    const index = stages.findIndex(s => s.name === stageName)
    const defaultColor = COLOR_PALETTE[index % COLOR_PALETTE.length]
    return `${defaultColor.value} ${defaultColor.shadow} border-white/70`
  }

  // Применяем фильтры к сделкам
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const filteredDeals = deals.filter(deal => {
    if (normalizedSearch) {
      const searchFields = [
        deal.title,
        deal.contact?.name,
        deal.contact?.company || '',
        deal.contact?.email || '',
      ]
      const matchesSearch = searchFields.some(field =>
        field?.toLowerCase().includes(normalizedSearch)
      )
      if (!matchesSearch) return false
    }
    // Фильтр по статусам/этапам
    if (filters.status && filters.status.length > 0) {
      if (!filters.status.includes(deal.stage)) return false
    }

    // Фильтр по диапазону сумм
    if (filters.amountRange) {
      if (filters.amountRange.min !== undefined && deal.amount < filters.amountRange.min) return false
      if (filters.amountRange.max !== undefined && deal.amount > filters.amountRange.max) return false
    }

    // Фильтр по дате создания
    if (filters.dateRange && deal.createdAt) {
      const dealDate = new Date(deal.createdAt)
      const startDate = filters.dateRange.start ? new Date(filters.dateRange.start) : null
      const endDate = filters.dateRange.end ? new Date(filters.dateRange.end) : null
      
      if (startDate && dealDate < startDate) return false
      if (endDate) {
        const endDateEnd = new Date(endDate)
        endDateEnd.setHours(23, 59, 59, 999)
        if (dealDate > endDateEnd) return false
      }
    }

    // Фильтр по ожидаемой дате закрытия
    if (filters.expectedCloseDateRange && deal.expectedCloseDate) {
      const closeDate = new Date(deal.expectedCloseDate)
      const startDate = filters.expectedCloseDateRange.start ? new Date(filters.expectedCloseDateRange.start) : null
      const endDate = filters.expectedCloseDateRange.end ? new Date(filters.expectedCloseDateRange.end) : null
      
      if (startDate && closeDate < startDate) return false
      if (endDate) {
        const endDateEnd = new Date(endDate)
        endDateEnd.setHours(23, 59, 59, 999)
        if (closeDate > endDateEnd) return false
      }
    }

    return true
  })

  const stages = getStages()
  const dealsByStage = stages.reduce((acc, stage) => {
    acc[stage.name] = filteredDeals.filter(deal => deal.stage === stage.name)
    return acc
  }, {} as Record<string, Deal[]>)

  const totalAmount = filteredDeals.reduce((sum, deal) => sum + deal.amount, 0)
  const wonDeals = filteredDeals.filter(d => d.stage === 'Закрыто и реализованное')
  const wonAmount = wonDeals.reduce((sum, deal) => sum + deal.amount, 0)
  const activeDealsCount = filteredDeals.filter(deal => !deal.stage.toLowerCase().includes('закрыто')).length
  const averageCheck = filteredDeals.length ? Math.round(totalAmount / filteredDeals.length) : 0
  const conversionRate = filteredDeals.length ? Math.round((wonDeals.length / filteredDeals.length) * 100) : 0
  const upcomingClosings = filteredDeals.filter(deal => {
    if (!deal.expectedCloseDate) return false
    const closeDate = new Date(deal.expectedCloseDate)
    const now = new Date()
    const twoWeeks = new Date()
    twoWeeks.setDate(now.getDate() + 14)
    return closeDate >= now && closeDate <= twoWeeks
  }).length
  const currentPipeline = selectedPipeline ? pipelines.find((p) => p.id === selectedPipeline) : null

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Skeleton variant="text" width={150} height={12} />
            <Skeleton variant="text" width={200} height={32} />
            <Skeleton variant="text" width={400} height={16} />
          </div>
          <div className="flex gap-3">
            <Skeleton variant="rectangular" width={120} height={40} />
            <Skeleton variant="rectangular" width={150} height={40} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card">
              <Skeleton variant="text" width="60%" height={12} className="mb-3" />
              <Skeleton variant="text" width="100%" height={32} className="mb-2" />
              <Skeleton variant="text" width="80%" height={12} />
            </div>
          ))}
        </div>
        <SkeletonKanban />
      </div>
    )
  }

  return (
    <div className="space-y-7 relative">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1 flex-shrink min-w-0 lg:max-w-[45%]">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            Управление воронкой
          </p>
          <h1 className="text-xl lg:text-2xl font-semibold text-[var(--foreground)]">Сделки</h1>
          <p className="text-xs lg:text-sm text-[var(--muted)] hidden md:block">
            Перетаскивайте карточки между этапами и контролируйте воронку в реальном времени.
          </p>
        </div>
        <div className="flex flex-nowrap gap-1.5 flex-shrink-0 overflow-x-auto lg:overflow-visible">
          <button
            onClick={() => setIsFiltersModalOpen(true)}
            className="btn-secondary text-xs lg:text-sm flex items-center gap-1.5 px-3 py-2 whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Фильтр
          </button>
          <ExportButton 
            entityType="deals" 
            label="Экспорт CSV"
            className="text-xs lg:text-sm"
          />
          <button
            onClick={() => setIsPipelineManagerOpen(true)}
            className="btn-secondary text-xs lg:text-sm flex items-center gap-1.5 px-3 py-2 whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
            </svg>
            Управление воронками
          </button>
          <button
            onClick={() => {
              if (!selectedPipeline) return
              setIsStagesEditorOpen(true)
            }}
            className="btn-secondary text-xs lg:text-sm flex items-center gap-1.5 px-3 py-2 whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Настроить этапы
          </button>
        </div>
      </div>


      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Всего сделок', value: filteredDeals.length, note: 'Все стадии' },
          { label: 'В работе', value: activeDealsCount, note: `${upcomingClosings} закрытий в 14 дней` },
          { label: 'Портфель', value: `${totalAmount.toLocaleString('ru-RU')} ₽`, note: `Средний чек ${averageCheck.toLocaleString('ru-RU')} ₽` },
          { label: 'Конверсия', value: `${conversionRate}%`, note: `${wonDeals.length} закрыто успешно` },
        ].map((card) => (
          <div key={card.label} className="stat-card">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)] mb-1">{card.label}</p>
            <p className="stat-card-value">{card.value}</p>
            <p className="text-sm text-[var(--muted)]">{card.note}</p>
          </div>
        ))}
      </div>

      {/* Канбан-доска */}
      <div className="glass-panel p-6 rounded-3xl shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)] mb-1">Активная воронка</p>
            <p className="text-base font-semibold text-[var(--foreground)]">
              {currentPipeline?.name || '—'}
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary text-sm"
          >
            + Новая сделка
          </button>
        </div>
        <p className="text-sm text-[var(--muted)] mb-4">
          Перетаскивайте карточки между колонками, чтобы изменять этапы и держать воронку в актуальном состоянии.
        </p>

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragEnd={handleDealDragEnd}
          onDragStart={(event) => {
            const deal = deals.find(d => d.id === parseInt(event.active.id as string))
            setActiveDeal(deal || null)
          }}
          onDragCancel={() => setActiveDeal(null)}
        >
          <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
            <div className="flex space-x-4 min-w-max pb-4">
              {stages.map((stage, index) => (
                <DealColumn
                  key={stage.name}
                  stage={stage.name}
                  deals={dealsByStage[stage.name] || []}
                  onDelete={handleDelete}
                  onEdit={(deal) => {
                    setViewingDeal(deal)
                  }}
                  color={getStageColor(stage.name)}
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
        <div className="modal-overlay" onClick={() => { setIsModalOpen(false); resetFormState(); }}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)] font-semibold mb-1">Новая сделка</p>
                <h3 className="text-2xl font-bold text-[var(--foreground)]">Создать сделку</h3>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  resetFormState()
                }}
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-2 hover:bg-[var(--background-soft)] rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Название сделки *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
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
                    {stages.filter(s => s.name !== UNASSIGNED_STAGE).map(stage => (
                      <option key={stage.name} value={stage.name}>{stage.name}</option>
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

                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    resetFormState()
                  }}
                  className="btn-secondary text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn-primary text-sm btn-ripple"
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
          stages={getStages().filter(s => s.name !== UNASSIGNED_STAGE)}
          onStagesChange={handleStagesUpdate}
          onClose={() => setIsStagesEditorOpen(false)}
          unassignedStage={UNASSIGNED_STAGE}
        />
      )}

      {/* Модальное окно управления воронками */}
      {isPipelineManagerOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center p-4 z-[99999]" 
          onClick={() => setIsPipelineManagerOpen(false)}
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            zIndex: 99999
          }}
        >
          <div 
            className="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col z-[100000]" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              zIndex: 100000, 
              position: 'relative',
              margin: 'auto'
            }}
          >
            <PipelineManager
              pipelines={pipelines}
              onPipelinesChange={fetchData}
              onSelectPipeline={(id) => {
                handlePipelineChange(id)
                setIsPipelineManagerOpen(false)
              }}
              selectedPipelineId={selectedPipeline}
              isExternalOpen={isPipelineManagerOpen}
              onExternalClose={() => setIsPipelineManagerOpen(false)}
            />
          </div>
        </div>
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

      {/* Модальное окно просмотра деталей сделки - упрощенное, без вкладок */}
      {viewingDeal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-xl font-semibold">{viewingDeal.title}</h3>
              <button
                onClick={() => setViewingDeal(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Все содержимое в одной прокручиваемой области */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Основная информация */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Основная информация</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Клиент</label>
                    <p className="text-gray-900">
                      <a
                        href={`/contacts/${viewingDeal.contact.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {viewingDeal.contact.name}
                      </a>
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Сумма</label>
                    <p className="text-gray-900 font-medium">
                      {viewingDeal.amount.toLocaleString('ru-RU')} {viewingDeal.currency}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Вероятность</label>
                    <p className="text-gray-900">{viewingDeal.probability}%</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Этап</label>
                    <p className="text-gray-900">{viewingDeal.stage}</p>
                  </div>
                  {viewingDeal.expectedCloseDate && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Ожидаемая дата закрытия</label>
                      <p className="text-gray-900">
                        {new Date(viewingDeal.expectedCloseDate).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  )}
                  {viewingDeal.user && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Ответственный</label>
                      <p className="text-gray-900">{viewingDeal.user.name}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Комментарии */}
              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Комментарии</h4>
                <Comments
                  entityType="deal"
                  entityId={viewingDeal.id}
                />
              </div>

              {/* Теги */}
              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Теги</h4>
                <TagsManager
                  entityType="deal"
                  entityId={viewingDeal.id}
                />
              </div>

              {/* Дополнительные поля */}
              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Дополнительные поля</h4>
                <CustomFieldsEditor
                  entityType="deal"
                  entityId={viewingDeal.id}
                />
              </div>

              {/* Файлы */}
              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Файлы</h4>
                <FilesManager
                  entityType="deal"
                  entityId={viewingDeal.id}
                />
              </div>
            </div>

            <div className="p-6 border-t flex justify-end">
              <button
                onClick={() => setViewingDeal(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Закрыть
              </button>
              <button
                onClick={() => {
                  setEditingDeal(viewingDeal)
                  setViewingDeal(null)
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 ml-3"
              >
                Редактировать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно фильтров */}
      <FiltersModal
        isOpen={isFiltersModalOpen}
        onClose={() => setIsFiltersModalOpen(false)}
        entityType="deals"
        onFilterChange={setFilters}
        savedFilters={savedFilters}
        users={users}
        pipelines={pipelines}
        selectedUserId={selectedUserId}
        selectedPipelineId={selectedPipeline}
        onUserIdChange={setSelectedUserId}
        onPipelineIdChange={(pipelineId) => {
          if (pipelineId) {
            handlePipelineChange(pipelineId)
          } else {
            setSelectedPipeline(null)
          }
        }}
        onSaveFilter={(name, filterData) => {
          const newFilter = {
            id: Date.now(),
            name,
            filters: filterData,
          }
          const updated = [...savedFilters, newFilter]
          setSavedFilters(updated)
          localStorage.setItem('savedFilters_deals', JSON.stringify(updated))
        }}
        onDeleteFilter={(id) => {
          const updated = savedFilters.filter(f => f.id !== id)
          setSavedFilters(updated)
          localStorage.setItem('savedFilters_deals', JSON.stringify(updated))
        }}
      />
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
      style={{ minHeight: '200px' }}
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
      <div 
        className="absolute inset-x-4 top-2 h-1 rounded-full transition-all duration-300" 
        style={{ background: 'var(--primary-gradient)' }}
      />
      <div className="flex justify-between items-start mb-2">
        <h4 
          className="font-medium text-gray-900 text-sm flex-1 pr-2 cursor-pointer hover:text-blue-600"
          onDoubleClick={(e) => {
            e.stopPropagation()
            onEdit(deal)
          }}
        >
          {deal.title}
        </h4>
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
