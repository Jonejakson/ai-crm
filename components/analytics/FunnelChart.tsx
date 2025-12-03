'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

interface FunnelStage {
  name: string
  count: number
  amount: number
  conversion?: number
}

interface FunnelChartProps {
  stages: FunnelStage[]
  pipelineName: string
}

export default function FunnelChart({ stages, pipelineName }: FunnelChartProps) {
  const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d946ef', '#ec4899']
  
  const chartData = stages.map((stage, index) => ({
    name: stage.name,
    count: stage.count,
    amount: stage.amount,
    conversion: stage.conversion || 0,
    color: colors[index % colors.length],
  }))

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">{pipelineName}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart 
          data={chartData} 
          layout="vertical" 
          margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
          barCategoryGap="10%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <ReferenceLine x={0} stroke="#e5e7eb" strokeWidth={1} />
          <XAxis 
            type="number" 
            stroke="#6b7280" 
            style={{ fontSize: '12px' }}
            domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.1)]}
            allowDecimals={false}
            tick={{ fontSize: '12px' }}
            allowDataOverflow={false}
          />
          <YAxis 
            dataKey="name" 
            type="category" 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            width={90}
            tick={{ fontSize: '12px' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px'
            }}
            formatter={(value: number, name: string) => {
              if (name === 'count') {
                return [value, 'Количество сделок']
              }
              if (name === 'amount') {
                return [`${value.toLocaleString('ru-RU')} ₽`, 'Сумма']
              }
              if (name === 'conversion') {
                return [`${value.toFixed(1)}%`, 'Конверсия']
              }
              return [value, name]
            }}
          />
          <Legend 
            formatter={(value) => {
              const names: Record<string, string> = {
                count: 'Количество',
                amount: 'Сумма (₽)',
                conversion: 'Конверсия (%)',
              }
              return names[value] || value
            }}
          />
          <Bar 
            dataKey="count" 
            fill="#6366f1" 
            radius={[0, 8, 8, 0]}
            minPointSize={0}
            isAnimationActive={false}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-4 mt-4">
        {chartData.map((stage, index) => (
          <div key={stage.name} className="p-3 rounded-lg bg-white/50 border border-[var(--border)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[var(--foreground)]">{stage.name}</span>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
            </div>
            <div className="text-xs text-[var(--muted)] space-y-1">
              <div>Сделок: <span className="font-semibold text-[var(--foreground)]">{stage.count}</span></div>
              <div>Сумма: <span className="font-semibold text-[var(--foreground)]">{stage.amount.toLocaleString('ru-RU')} ₽</span></div>
              {stage.conversion > 0 && (
                <div>Конверсия: <span className="font-semibold text-[var(--primary)]">{stage.conversion.toFixed(1)}%</span></div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

