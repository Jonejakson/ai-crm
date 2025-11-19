'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

interface ManagerStats {
  manager: {
    id: number
    name: string
    email: string
  }
  deals: {
    total: number
    active: number
    won: number
    lost: number
    wonAmount: number
    totalAmount: number
    conversion: number
    avgDealAmount: number
  }
  tasks: {
    total: number
    completed: number
    overdue: number
    completionRate: number
  }
  contacts: {
    total: number
    withDeals: number
  }
  events: {
    total: number
    upcoming: number
  }
}

interface ManagersReportProps {
  managers: ManagerStats[]
}

export default function ManagersReport({ managers }: ManagersReportProps) {
  const chartData = managers.map(manager => ({
    name: manager.manager.name.split(' ')[0], // Только имя
    wonAmount: manager.deals.wonAmount,
    totalAmount: manager.deals.totalAmount,
    conversion: manager.deals.conversion,
    won: manager.deals.won,
    total: manager.deals.total,
  }))

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-3xl p-6">
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Эффективность менеджеров</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="name" 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px'
              }}
              formatter={(value: number, name: string) => {
                if (name === 'wonAmount' || name === 'totalAmount') {
                  return [`${value.toLocaleString('ru-RU')} ₽`, name === 'wonAmount' ? 'Выиграно' : 'Всего']
                }
                if (name === 'conversion') {
                  return [`${value.toFixed(1)}%`, 'Конверсия']
                }
                return [value, name === 'won' ? 'Выиграно' : 'Всего']
              }}
            />
            <Legend 
              formatter={(value) => {
                const names: Record<string, string> = {
                  wonAmount: 'Выиграно (₽)',
                  totalAmount: 'Всего (₽)',
                  conversion: 'Конверсия (%)',
                }
                return names[value] || value
              }}
            />
            <Bar dataKey="wonAmount" fill="#22c55e" radius={[8, 8, 0, 0]} />
            <Bar dataKey="totalAmount" fill="#6366f1" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {managers.map((manager) => (
          <div key={manager.manager.id} className="glass-panel rounded-3xl p-6">
            <div className="mb-4">
              <h4 className="font-semibold text-[var(--foreground)]">{manager.manager.name}</h4>
              <p className="text-xs text-[var(--muted)]">{manager.manager.email}</p>
            </div>
            
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-[var(--success-soft)]/30">
                <div className="text-xs text-[var(--muted)] mb-1">Выиграно</div>
                <div className="text-lg font-semibold text-[var(--success)]">
                  {manager.deals.wonAmount.toLocaleString('ru-RU')} ₽
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  {manager.deals.won} из {manager.deals.total} сделок ({manager.deals.conversion.toFixed(1)}%)
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-white/50">
                  <div className="text-xs text-[var(--muted)]">Задач</div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">
                    {manager.tasks.completed}/{manager.tasks.total}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {manager.tasks.completionRate.toFixed(0)}%
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-white/50">
                  <div className="text-xs text-[var(--muted)]">Контактов</div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">
                    {manager.contacts.total}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {manager.contacts.withDeals} с сделками
                  </div>
                </div>
              </div>

              {manager.tasks.overdue > 0 && (
                <div className="p-2 rounded-lg bg-[var(--error-soft)]/30">
                  <div className="text-xs text-[var(--error)]">
                    ⚠️ Просрочено задач: {manager.tasks.overdue}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

