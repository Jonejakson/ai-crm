'use client'

import { useState } from 'react'
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

interface PipelineStagesEditorProps {
  stages: string[]
  onStagesChange: (stages: string[]) => void
  onClose: () => void
  unassignedStage?: string // Этап, который нельзя удалить
}

function SortableStageItem({ 
  stage, 
  index, 
  onDelete, 
  onEdit,
  isUnremovable 
}: { 
  stage: string
  index: number
  onDelete: () => void
  onEdit: () => void
  isUnremovable?: boolean 
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

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
        {stage}
        {isUnremovable && <span className="ml-2 text-xs text-gray-500">(не удаляется)</span>}
      </span>
      <div className="flex items-center gap-2">
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
  const [localStages, setLocalStages] = useState<string[]>(stages)
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
        const oldIndex = items.indexOf(active.id as string)
        const newIndex = items.indexOf(over.id as string)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleAddStage = () => {
    if (newStageName.trim() && !localStages.includes(newStageName.trim())) {
      setLocalStages([...localStages, newStageName.trim()])
      setNewStageName('')
    }
  }

  const handleDeleteStage = (stage: string) => {
    setLocalStages(localStages.filter(s => s !== stage))
  }

  const handleEditStage = (stage: string) => {
    setEditingStage(stage)
    setEditingStageName(stage)
  }

  const handleSaveEdit = () => {
    if (editingStage && editingStageName.trim()) {
      // Разрешаем сохранить, если имя не изменилось или если новое имя уникально
      if (editingStageName.trim() === editingStage || !localStages.includes(editingStageName.trim())) {
        setLocalStages(localStages.map(s => s === editingStage ? editingStageName.trim() : s))
        setEditingStage(null)
        setEditingStageName('')
      }
    }
  }

  const handleCancelEdit = () => {
    setEditingStage(null)
    setEditingStageName('')
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
              items={localStages}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {localStages.map((stage, index) => (
                  editingStage === stage ? (
                    <div key={`edit-${index}-${stage}`} className="flex items-center gap-2 p-3 bg-white border border-gray-300 rounded-lg mb-2">
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
                      key={`${index}-${stage}`}
                      stage={stage}
                      index={index}
                      onDelete={() => handleDeleteStage(stage)}
                      onEdit={() => handleEditStage(stage)}
                      isUnremovable={unassignedStage === stage}
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

