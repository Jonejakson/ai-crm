'use client'

import { useState, useRef, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Stage {
  name: string
  color: string
}

interface PipelineStagesEditorProps {
  stages: string[] | Stage[]
  onStagesChange: (stages: string[] | Stage[]) => void
  onClose: () => void
  unassignedStage?: string // Этап, который нельзя удалить
}

// Палитра цветов для этапов (24 цвета)
const COLOR_PALETTE = [
  { name: 'Синий', value: 'bg-gradient-to-b from-[#e6f0ff] via-[#edf4ff] to-[#f8fbff]', shadow: 'shadow-[0_25px_35px_-25px_rgba(47,111,237,0.55)]' },
  { name: 'Фиолетовый', value: 'bg-gradient-to-b from-[#f7ecff] via-[#fbf3ff] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(139,92,246,0.45)]' },
  { name: 'Оранжевый', value: 'bg-gradient-to-b from-[#fff3e6] via-[#fff9f1] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(255,179,71,0.45)]' },
  { name: 'Зеленый', value: 'bg-gradient-to-b from-[#e7fff7] via-[#f4fffb] to-white', shadow: 'shadow-[0_25px_30px_-25px_rgba(16,185,129,0.45)]' },
  { name: 'Голубой', value: 'bg-gradient-to-b from-[#e9f5ff] via-[#f3f9ff] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(59,130,246,0.35)]' },
  { name: 'Розовый', value: 'bg-gradient-to-b from-[#fff0f2] via-[#fff7f8] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(239,68,68,0.35)]' },
  { name: 'Желтый', value: 'bg-gradient-to-b from-[#fffbeb] via-[#fef9c3] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(234,179,8,0.35)]' },
  { name: 'Бирюзовый', value: 'bg-gradient-to-b from-[#ecfeff] via-[#cffafe] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(6,182,212,0.35)]' },
  { name: 'Красный', value: 'bg-gradient-to-b from-[#fee2e2] via-[#fecaca] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(239,68,68,0.4)]' },
  { name: 'Изумрудный', value: 'bg-gradient-to-b from-[#d1fae5] via-[#a7f3d0] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(16,185,129,0.4)]' },
  { name: 'Индиго', value: 'bg-gradient-to-b from-[#e0e7ff] via-[#c7d2fe] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(99,102,241,0.4)]' },
  { name: 'Лавандовый', value: 'bg-gradient-to-b from-[#f3e8ff] via-[#e9d5ff] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(168,85,247,0.4)]' },
  { name: 'Коралловый', value: 'bg-gradient-to-b from-[#ffe4e6] via-[#fecdd3] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(251,113,133,0.4)]' },
  { name: 'Мятный', value: 'bg-gradient-to-b from-[#d1fae5] via-[#a7f3d0] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(5,150,105,0.4)]' },
  { name: 'Небесный', value: 'bg-gradient-to-b from-[#e0f2fe] via-[#bae6fd] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(14,165,233,0.4)]' },
  { name: 'Персиковый', value: 'bg-gradient-to-b from-[#fff1f2] via-[#ffe4e6] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(244,63,94,0.4)]' },
  { name: 'Сливовый', value: 'bg-gradient-to-b from-[#faf5ff] via-[#f3e8ff] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(147,51,234,0.4)]' },
  { name: 'Лаймовый', value: 'bg-gradient-to-b from-[#f7fee7] via-[#ecfccb] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(132,204,22,0.4)]' },
  { name: 'Аквамарин', value: 'bg-gradient-to-b from-[#ecfeff] via-[#cffafe] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(6,182,212,0.4)]' },
  { name: 'Абрикосовый', value: 'bg-gradient-to-b from-[#fff7ed] via-[#ffedd5] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(249,115,22,0.4)]' },
  { name: 'Сирень', value: 'bg-gradient-to-b from-[#faf5ff] via-[#f3e8ff] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(168,85,247,0.4)]' },
  { name: 'Морской', value: 'bg-gradient-to-b from-[#f0f9ff] via-[#e0f2fe] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(2,132,199,0.4)]' },
  { name: 'Песочный', value: 'bg-gradient-to-b from-[#fffbeb] via-[#fef3c7] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(217,119,6,0.4)]' },
  { name: 'Вишневый', value: 'bg-gradient-to-b from-[#fef2f2] via-[#fee2e2] to-white', shadow: 'shadow-[0_25px_35px_-25px_rgba(220,38,38,0.4)]' },
]

function SortableStageItem({ 
  stage, 
  index, 
  onDelete, 
  onEdit,
  onColorChange,
  isUnremovable 
}: { 
  stage: Stage
  index: number
  onDelete: () => void
  onEdit: () => void
  onColorChange: (color: string) => void
  isUnremovable?: boolean 
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.name })

  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false)
  const colorPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setIsColorPickerOpen(false)
      }
    }

    if (isColorPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isColorPickerOpen])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const currentColor = COLOR_PALETTE.find(c => c.value === stage.color) || COLOR_PALETTE[0]

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 bg-white border border-gray-300 rounded-lg mb-2"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        ☰
      </div>
      <span className="flex-1 font-medium">
        {stage.name}
        {isUnremovable && <span className="ml-2 text-xs text-gray-500">(не удаляется)</span>}
      </span>
      <div className="flex items-center gap-2">
        {/* Кнопка выбора цвета */}
        <div className="relative" ref={colorPickerRef}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsColorPickerOpen(!isColorPickerOpen)
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-gray-300 hover:border-gray-400 transition-colors"
            title="Изменить цвет"
          >
            <div className={`w-5 h-5 rounded ${currentColor.value} ${currentColor.shadow}`} />
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </button>
          {isColorPickerOpen && (
            <div className="absolute right-0 top-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-50 min-w-[200px]">
              <div className="text-xs font-semibold text-gray-700 mb-2">Выберите цвет:</div>
              <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color.value}
                    onClick={(e) => {
                      e.stopPropagation()
                      onColorChange(color.value)
                      setIsColorPickerOpen(false)
                    }}
                    className={`w-8 h-8 rounded ${color.value} ${color.shadow} border-2 transition-all ${
                      stage.color === color.value ? 'border-blue-500 scale-110' : 'border-transparent hover:scale-105'
                    }`}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={onEdit}
          className="text-[#10b981] hover:text-[#059669] transition-colors"
          title="Редактировать"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        {!isUnremovable && (
          <button
            onClick={onDelete}
            className="text-red-500 hover:text-red-700 text-sm"
          >
            Удалить
          </button>
        )}
      </div>
    </div>
  )
}

export default function PipelineStagesEditor({ stages, onStagesChange, onClose, unassignedStage }: PipelineStagesEditorProps) {
  // Преобразуем старый формат (массив строк) в новый (массив объектов)
  const normalizeStages = (stages: string[] | Stage[]): Stage[] => {
    return stages.map((stage, index) => {
      if (typeof stage === 'string') {
        // Старый формат - используем цвет по умолчанию
        const defaultColor = COLOR_PALETTE[index % COLOR_PALETTE.length]
        return { name: stage, color: defaultColor.value }
      }
      return stage
    })
  }

  const [localStages, setLocalStages] = useState<Stage[]>(normalizeStages(stages))
  const [newStageName, setNewStageName] = useState('')
  const [editingStage, setEditingStage] = useState<string | null>(null)
  const [editingStageName, setEditingStageName] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setLocalStages((items) => {
        const oldIndex = items.findIndex(item => item.name === active.id)
        const newIndex = items.findIndex(item => item.name === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleAddStage = () => {
    if (newStageName.trim() && !localStages.some(s => s.name === newStageName.trim())) {
      const defaultColor = COLOR_PALETTE[localStages.length % COLOR_PALETTE.length]
      setLocalStages([...localStages, { name: newStageName.trim(), color: defaultColor.value }])
      setNewStageName('')
    }
  }

  const handleDeleteStage = (stageName: string) => {
    setLocalStages(localStages.filter(s => s.name !== stageName))
  }

  const handleEditStage = (stageName: string) => {
    setEditingStage(stageName)
    const stage = localStages.find(s => s.name === stageName)
    setEditingStageName(stage?.name || '')
  }

  const handleSaveEdit = () => {
    if (editingStage && editingStageName.trim()) {
      const existingStage = localStages.find(s => s.name === editingStage)
      // Разрешаем сохранить, если имя не изменилось или если новое имя уникально
      if (editingStageName.trim() === editingStage || !localStages.some(s => s.name === editingStageName.trim())) {
        setLocalStages(localStages.map(s => 
          s.name === editingStage 
            ? { ...s, name: editingStageName.trim() }
            : s
        ))
        setEditingStage(null)
        setEditingStageName('')
      }
    }
  }

  const handleCancelEdit = () => {
    setEditingStage(null)
    setEditingStageName('')
  }

  const handleColorChange = (stageName: string, color: string) => {
    setLocalStages(localStages.map(s => 
      s.name === stageName ? { ...s, color } : s
    ))
  }

  const handleSave = () => {
    onStagesChange(localStages)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Управление этапами воронки</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Добавить новый этап
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddStage()}
              placeholder="Название этапа"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddStage}
              className="btn-primary text-sm"
            >
              Добавить
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Порядок этапов (перетащите для изменения порядка)
          </label>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localStages.map(s => s.name)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {localStages.map((stage, index) => (
                  editingStage === stage.name ? (
                    <div key={`edit-${index}-${stage.name}`} className="flex items-center gap-2 p-3 bg-white border border-gray-300 rounded-lg mb-2">
                      <input
                        type="text"
                        value={editingStageName}
                        onChange={(e) => setEditingStageName(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveEdit()
                          } else if (e.key === 'Escape') {
                            handleCancelEdit()
                          }
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#10b981]"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveEdit}
                        className="btn-primary text-sm"
                      >
                        Сохранить
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
                      >
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <SortableStageItem
                      key={`${index}-${stage.name}`}
                      stage={stage}
                      index={index}
                      onDelete={() => handleDeleteStage(stage.name)}
                      onEdit={() => handleEditStage(stage.name)}
                      onColorChange={(color) => handleColorChange(stage.name, color)}
                      isUnremovable={unassignedStage === stage.name}
                    />
                  )
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            className="btn-primary text-sm"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
