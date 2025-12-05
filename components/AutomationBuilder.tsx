'use client'

import { useState, useCallback, useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
  NodeTypes,
  Handle,
  Position,
} from 'reactflow'
import 'reactflow/dist/style.css'

interface AutomationNodeData {
  label: string
  type: 'trigger' | 'condition' | 'action'
  config?: any
  automationType?: string // для триггеров и действий
  onConfigChange?: (config: any) => void
  onDelete?: () => void
}

interface AutomationBuilderProps {
  triggerTypes: Array<{ value: string; label: string }>
  actionTypes: Array<{ value: string; label: string }>
  users?: Array<{ id: number; name: string; email: string }>
  initialData?: {
    triggerType: string
    triggerConfig: any
    actions: Array<{ type: string; params: any }>
  }
  onSave?: (data: { triggerType: string; triggerConfig: any; actions: Array<{ type: string; params: any }> }) => void
}

// Кастомные ноды
function TriggerNode({ data, selected }: { data: AutomationNodeData; selected: boolean }) {
  return (
    <div
      className={`px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg border-2 ${
        selected ? 'border-blue-300 ring-2 ring-blue-300' : 'border-blue-600'
      } min-w-[220px]`}
    >
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-white border-2 border-blue-600" />
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
        <span className="text-xs font-semibold text-white uppercase tracking-wide">Триггер</span>
      </div>
      <div className="text-white font-medium text-sm">{data.label}</div>
      {data.config && (
        <div className="mt-2 text-xs text-blue-100 space-y-1">
          {data.config.stage && <div>Этап: {data.config.stage}</div>}
          {data.config.minAmount && <div>Мин. сумма: {data.config.minAmount}₽</div>}
          {data.config.maxAmount && <div>Макс. сумма: {data.config.maxAmount}₽</div>}
        </div>
      )}
    </div>
  )
}

function ConditionNode({ data, selected }: { data: AutomationNodeData; selected: boolean }) {
  return (
    <div
      className={`px-4 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl shadow-lg border-2 ${
        selected ? 'border-yellow-300 ring-2 ring-yellow-300' : 'border-yellow-600'
      } min-w-[220px]`}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-white border-2 border-yellow-600" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-white border-2 border-yellow-600" />
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 bg-white rounded-full" />
        <span className="text-xs font-semibold text-white uppercase tracking-wide">Условие</span>
      </div>
      <div className="text-white font-medium text-sm">{data.label}</div>
    </div>
  )
}

function ActionNode({ data, selected }: { data: AutomationNodeData; selected: boolean }) {
  return (
    <div
      className={`px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl shadow-lg border-2 ${
        selected ? 'border-green-300 ring-2 ring-green-300' : 'border-green-600'
      } min-w-[220px]`}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-white border-2 border-green-600" />
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 bg-white rounded-full" />
        <span className="text-xs font-semibold text-white uppercase tracking-wide">Действие</span>
      </div>
      <div className="text-white font-medium text-sm">{data.label}</div>
      {data.config && (
        <div className="mt-2 text-xs text-green-100 space-y-1">
          {data.config.title && <div>Задача: {data.config.title}</div>}
          {data.config.subject && <div>Тема: {data.config.subject}</div>}
          {data.config.probability !== undefined && <div>Вероятность: {data.config.probability}%</div>}
        </div>
      )}
    </div>
  )
}

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
}

export default function AutomationBuilder({
  triggerTypes,
  actionTypes,
  users = [],
  initialData,
  onSave,
}: AutomationBuilderProps) {
  // Создаем начальные ноды из initialData
  const initialNodes: Node[] = useMemo(() => {
    const nodes: Node[] = []
    
    if (initialData) {
      // Триггер
      const triggerLabel = triggerTypes.find((t) => t.value === initialData.triggerType)?.label || initialData.triggerType
      nodes.push({
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 250, y: 50 },
        data: {
          label: triggerLabel,
          type: 'trigger',
          automationType: initialData.triggerType,
          config: initialData.triggerConfig || {},
        },
      })

      // Действия
      initialData.actions.forEach((action, index) => {
        const actionLabel = actionTypes.find((a) => a.value === action.type)?.label || action.type
        nodes.push({
          id: `action-${index + 1}`,
          type: 'action',
          position: { x: 250, y: 200 + index * 150 },
          data: {
            label: actionLabel,
            type: 'action',
            automationType: action.type,
            config: action.params || {},
          },
        })
      })
    } else {
      // Пустой редактор - только триггер по умолчанию
      nodes.push({
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 250, y: 50 },
        data: {
          label: 'Выберите триггер',
          type: 'trigger',
          automationType: triggerTypes[0]?.value,
          config: {},
        },
      })
    }

    return nodes
  }, [initialData, triggerTypes, actionTypes])

  const initialEdges: Edge[] = useMemo(() => {
    if (!initialData || initialData.actions.length === 0) return []
    
    const edges: Edge[] = []
    edges.push({
      id: 'e-trigger-action-1',
      source: 'trigger-1',
      target: 'action-1',
      type: 'smoothstep',
    })

    // Соединяем действия последовательно
    for (let i = 1; i < initialData.actions.length; i++) {
      edges.push({
        id: `e-action-${i}-action-${i + 1}`,
        source: `action-${i}`,
        target: `action-${i + 1}`,
        type: 'smoothstep',
      })
    }

    return edges
  }, [initialData])

  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)

  const onConnect = useCallback(
    (params: Connection) => {
      // Проверяем, что соединяем правильные типы нодов
      const sourceNode = nodes.find((n) => n.id === params.source)
      const targetNode = nodes.find((n) => n.id === params.target)

      if (!sourceNode || !targetNode) return

      // Триггер может соединяться только с действиями или условиями
      // Условия могут соединяться с действиями
      // Действия могут соединяться только с другими действиями
      if (sourceNode.type === 'trigger' && targetNode.type !== 'action' && targetNode.type !== 'condition') return
      if (sourceNode.type === 'condition' && targetNode.type !== 'action') return
      if (sourceNode.type === 'action' && targetNode.type !== 'action') return

      const newEdges = addEdge(params, edges)
      setEdges(newEdges)
    },
    [edges, nodes]
  )

  const onNodesChange = useCallback(
    (changes: any) => {
      onNodesChangeInternal(changes)
      
      // Отслеживаем выбранный узел
      changes.forEach((change: any) => {
        if (change.type === 'select' && change.selected) {
          const node = nodes.find((n) => n.id === change.id)
          setSelectedNode(node || null)
        } else if (change.type === 'select' && !change.selected) {
          setSelectedNode(null)
        }
      })
    },
    [nodes, onNodesChangeInternal]
  )

  const addActionNode = useCallback(() => {
    const actionCount = nodes.filter((n) => n.type === 'action').length
    const newActionNode: Node = {
      id: `action-${actionCount + 1}`,
      type: 'action',
      position: { x: 250, y: 200 + actionCount * 150 },
      data: {
        label: 'Выберите действие',
        type: 'action',
        automationType: actionTypes[0]?.value,
        config: {},
      },
    }

    setNodes((nds) => [...nds, newActionNode])

    // Автоматически соединяем с последним действием или триггером
    const lastAction = nodes.filter((n) => n.type === 'action').pop()
    const sourceId = lastAction?.id || 'trigger-1'
    
    const newEdge: Edge = {
      id: `e-${sourceId}-${newActionNode.id}`,
      source: sourceId,
      target: newActionNode.id,
      type: 'smoothstep',
    }

    setEdges((eds) => [...eds, newEdge])
  }, [nodes, actionTypes, setNodes, setEdges])

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null)
      }
    },
    [selectedNode, setNodes, setEdges]
  )

  const updateNodeConfig = useCallback(
    (nodeId: string, config: any) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                config: { ...node.data.config, ...config },
              },
            }
          }
          return node
        })
      )
    },
    [setNodes]
  )

  const updateNodeType = useCallback(
    (nodeId: string, automationType: string, label: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                automationType,
                label,
              },
            }
          }
          return node
        })
      )
    },
    [setNodes]
  )

  const handleSave = useCallback(() => {
    const triggerNode = nodes.find((n) => n.type === 'trigger')
    if (!triggerNode) {
      alert('Необходимо настроить триггер')
      return
    }

    // Получаем все действия в правильном порядке (по позиции Y)
    const actionNodes = nodes
      .filter((n) => n.type === 'action')
      .sort((a, b) => a.position.y - b.position.y)

    if (actionNodes.length === 0) {
      alert('Добавьте хотя бы одно действие')
      return
    }

    const automationData = {
      triggerType: triggerNode.data.automationType || triggerTypes[0]?.value,
      triggerConfig: triggerNode.data.config || {},
      actions: actionNodes.map((node) => ({
        type: node.data.automationType || actionTypes[0]?.value,
        params: node.data.config || {},
      })),
    }

    onSave?.(automationData)
  }, [nodes, triggerTypes, actionTypes, onSave])

  return (
    <div className="space-y-4">
      {/* Панель инструментов */}
      <div className="flex items-center justify-between p-4 bg-[var(--surface)] rounded-2xl border border-[var(--border)]">
        <div className="flex items-center gap-2">
          <button
            onClick={addActionNode}
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
          >
            + Добавить действие
          </button>
          {selectedNode && selectedNode.type !== 'trigger' && (
            <button
              onClick={() => deleteNode(selectedNode.id)}
              className="px-4 py-2 bg-[var(--error)] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
            >
              Удалить блок
            </button>
          )}
        </div>
        {onSave && (
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
          >
            Сохранить автоматизацию
          </button>
        )}
      </div>

      {/* Визуальный редактор */}
      <div className="w-full h-[600px] border border-[var(--border)] rounded-2xl bg-[var(--background)] overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChangeInternal}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-[var(--background)]"
          connectionLineStyle={{ stroke: 'var(--primary)', strokeWidth: 2 }}
          defaultEdgeOptions={{
            style: { stroke: 'var(--primary)', strokeWidth: 2 },
            type: 'smoothstep',
          }}
          onNodeClick={(_, node) => setSelectedNode(node)}
        >
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="var(--border)" />
          <Controls className="bg-[var(--surface)] border border-[var(--border)]" />
          <MiniMap
            className="bg-[var(--surface)] border border-[var(--border)]"
            nodeColor={(node) => {
              if (node.type === 'trigger') return '#3b82f6'
              if (node.type === 'condition') return '#f59e0b'
              return '#10b981'
            }}
          />
        </ReactFlow>
      </div>

      {/* Панель настройки выбранного узла */}
      {selectedNode && (
        <div className="p-4 bg-[var(--surface)] rounded-2xl border border-[var(--border)]">
          <h3 className="text-lg font-semibold mb-4 text-[var(--foreground)]">
            Настройка: {selectedNode.data.label}
          </h3>
          <NodeConfigPanel
            node={selectedNode}
            triggerTypes={triggerTypes}
            actionTypes={actionTypes}
            users={users}
            onConfigChange={(config) => updateNodeConfig(selectedNode.id, config)}
            onTypeChange={(type, label) => updateNodeType(selectedNode.id, type, label)}
          />
        </div>
      )}
    </div>
  )
}

// Панель настройки узла
function NodeConfigPanel({
  node,
  triggerTypes,
  actionTypes,
  users,
  onConfigChange,
  onTypeChange,
}: {
  node: Node
  triggerTypes: Array<{ value: string; label: string }>
  actionTypes: Array<{ value: string; label: string }>
  users: Array<{ id: number; name: string; email: string }>
  onConfigChange: (config: any) => void
  onTypeChange: (type: string, label: string) => void
}) {
  const currentConfig = node.data.config || {}

  if (node.type === 'trigger') {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-[var(--foreground)]">Тип триггера</label>
          <select
            value={node.data.automationType || ''}
            onChange={(e) => {
              const selected = triggerTypes.find((t) => t.value === e.target.value)
              if (selected) {
                onTypeChange(selected.value, selected.label)
                onConfigChange({}) // Сбрасываем конфиг при смене типа
              }
            }}
            className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]"
          >
            {triggerTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {node.data.automationType === 'DEAL_STAGE_CHANGED' && (
          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--foreground)]">Этап сделки</label>
            <input
              type="text"
              value={currentConfig.stage || ''}
              onChange={(e) => onConfigChange({ ...currentConfig, stage: e.target.value })}
              placeholder="Например: negotiation"
              className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]"
            />
          </div>
        )}

        {node.data.automationType === 'DEAL_AMOUNT_CHANGED' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground)]">Мин. сумма (₽)</label>
              <input
                type="number"
                value={currentConfig.minAmount || ''}
                onChange={(e) =>
                  onConfigChange({
                    ...currentConfig,
                    minAmount: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground)]">Макс. сумма (₽)</label>
              <input
                type="number"
                value={currentConfig.maxAmount || ''}
                onChange={(e) =>
                  onConfigChange({
                    ...currentConfig,
                    maxAmount: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]"
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  if (node.type === 'action') {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-[var(--foreground)]">Тип действия</label>
          <select
            value={node.data.automationType || ''}
            onChange={(e) => {
              const selected = actionTypes.find((a) => a.value === e.target.value)
              if (selected) {
                onTypeChange(selected.value, selected.label)
                onConfigChange({}) // Сбрасываем конфиг при смене типа
              }
            }}
            className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]"
          >
            {actionTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {node.data.automationType === 'CREATE_TASK' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground)]">Заголовок задачи</label>
              <input
                type="text"
                value={currentConfig.title || ''}
                onChange={(e) => onConfigChange({ ...currentConfig, title: e.target.value })}
                placeholder="Позвонить клиенту"
                className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground)]">Срок (дни)</label>
              <input
                type="number"
                value={currentConfig.dueInDays || ''}
                onChange={(e) =>
                  onConfigChange({
                    ...currentConfig,
                    dueInDays: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="0"
                className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]"
              />
            </div>
          </>
        )}

        {node.data.automationType === 'SEND_EMAIL' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground)]">Тема письма</label>
              <input
                type="text"
                value={currentConfig.subject || ''}
                onChange={(e) => onConfigChange({ ...currentConfig, subject: e.target.value })}
                placeholder="Спасибо за встречу"
                className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground)]">Текст письма</label>
              <textarea
                value={currentConfig.body || ''}
                onChange={(e) => onConfigChange({ ...currentConfig, body: e.target.value })}
                rows={4}
                placeholder="Вы можете использовать плейсхолдеры: {{deal.title}}, {{contact.name}}"
                className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]"
              />
            </div>
          </>
        )}

        {node.data.automationType === 'CHANGE_PROBABILITY' && (
          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--foreground)]">Вероятность (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={currentConfig.probability || ''}
              onChange={(e) =>
                onConfigChange({
                  ...currentConfig,
                  probability: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="75"
              className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]"
            />
          </div>
        )}

        {node.data.automationType === 'ASSIGN_USER' && (
          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--foreground)]">Пользователь</label>
            <select
              value={currentConfig.userId || ''}
              onChange={(e) =>
                onConfigChange({
                  ...currentConfig,
                  userId: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]"
            >
              <option value="">Не выбрано</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    )
  }

  return null
}

