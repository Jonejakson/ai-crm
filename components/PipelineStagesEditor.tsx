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

function SortableStageItem({ stage, index, onDelete, isUnremovable }: { stage: string; index: number; onDelete: () => void; isUnremovable?: boolean }) {
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
      {!isUnremovable && (
        <button
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 text-sm"
        >
          Удалить
        </button>
      )}
    </div>
  )
}

export default function PipelineStagesEditor({ stages, onStagesChange, onClose, unassignedStage }: PipelineStagesEditorProps) {
  const [localStages, setLocalStages] = useState<string[]>(stages)
  const [newStageName, setNewStageName] = useState('')

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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
                  <SortableStageItem
                    key={stage}
                    stage={stage}
                    index={index}
                    onDelete={() => handleDeleteStage(stage)}
                    isUnremovable={unassignedStage === stage}
                  />
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

