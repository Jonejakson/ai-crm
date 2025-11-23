'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts'

interface SalesData {
  date: string
  total: number
  won: number
  lost: number
  active: number
  wonAmount: number
  totalAmount: number
  forecast: number
}

interface SalesChartProps {
  data: SalesData[]
  period: string
  height?: number
}

export default function SalesChart({ data, period, height = 400 }: SalesChartProps) {
  // Форматируем даты для отображения
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    if (period === 'year') {
      return date.toLocaleDateString('ru-RU', { month: 'short' })
    }
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  const chartData = data.map(item => ({
    ...item,
    dateFormatted: formatDate(item.date),
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorWonAmount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="dateFormatted" 
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
            if (name === 'wonAmount' || name === 'forecast') {
              return [`${value.toLocaleString('ru-RU')} ₽`, name === 'wonAmount' ? 'Выручка' : 'Прогноз']
            }
            return [value, name === 'total' ? 'Всего' : name === 'won' ? 'Закрыто успешно' : name === 'lost' ? 'Закрыто и не реализовано' : 'Активные']
          }}
        />
        <Legend 
          formatter={(value) => {
            const names: Record<string, string> = {
              wonAmount: 'Выручка (₽)',
              forecast: 'Прогноз (₽)',
              total: 'Всего сделок',
              won: 'Закрыто успешно',
              lost: 'Закрыто и не реализовано',
              active: 'Активные',
            }
            return names[value] || value
          }}
        />
        <Area 
          type="monotone" 
          dataKey="wonAmount" 
          stroke="#22c55e" 
          fillOpacity={1} 
          fill="url(#colorWonAmount)"
          strokeWidth={2}
        />
        <Area 
          type="monotone" 
          dataKey="forecast" 
          stroke="#6366f1" 
          fillOpacity={1} 
          fill="url(#colorForecast)"
          strokeWidth={2}
          strokeDasharray="5 5"
        />
        <Line 
          type="monotone" 
          dataKey="total" 
          stroke="#a855f7" 
          strokeWidth={2}
          dot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

