'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

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
      <LineChart data={chartData} margin={{ top: 10, right: 50, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="dateFormatted" 
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
        />
        <YAxis
          yAxisId="amount"
          stroke="#22c55e"
          style={{ fontSize: '12px' }}
          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
        />
        <YAxis
          yAxisId="count"
          orientation="right"
          stroke="#a855f7"
          style={{ fontSize: '12px' }}
          allowDecimals={false}
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
        <Line
          type="monotone"
          dataKey="wonAmount"
          yAxisId="amount"
          stroke="#22c55e"
          strokeWidth={3}
          dot={{ r: 4, fill: '#22c55e' }}
        />
        <Line
          type="monotone"
          dataKey="forecast"
          yAxisId="amount"
          stroke="#6366f1"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ r: 3, fill: '#6366f1' }}
        />
        <Line 
          type="monotone" 
          dataKey="total" 
          yAxisId="count"
          stroke="#a855f7" 
          strokeWidth={2}
          dot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

