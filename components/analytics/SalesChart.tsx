'use client'

import { useState, useEffect } from 'react'
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
  // Определяем, мобильное ли устройство
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  const chartHeight = isMobile ? 300 : height
  
  // Форматируем даты для отображения
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    if (period === 'year') {
      return date.toLocaleDateString('ru-RU', { month: 'short' })
    }
    // На мобильных сокращаем формат даты
    if (isMobile) {
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: '2-digit' })
    }
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  const chartData = data.map(item => ({
    ...item,
    dateFormatted: formatDate(item.date),
  }))

  // Адаптивные отступы - улучшены для мобильных
  const margin = isMobile 
    ? { top: 10, right: 5, left: 0, bottom: 50 }
    : { top: 10, right: 50, left: 0, bottom: 0 }

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <LineChart data={chartData} margin={margin}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="dateFormatted" 
          stroke="#6b7280"
          style={{ fontSize: isMobile ? '9px' : '12px' }}
          interval={isMobile ? 'preserveStartEnd' : (period === 'year' ? 'preserveStartEnd' : period === 'month' ? 2 : 0)}
          angle={period === 'year' ? (isMobile ? -30 : -45) : (isMobile ? -45 : 0)}
          textAnchor={period === 'year' || isMobile ? 'end' : 'middle'}
          height={period === 'year' ? (isMobile ? 60 : 60) : (isMobile ? 50 : 30)}
          tick={{ fontSize: isMobile ? '9px' : '12px' }}
          dy={isMobile ? 5 : 0}
        />
        <YAxis
          yAxisId="amount"
          stroke="#22c55e"
          style={{ fontSize: isMobile ? '9px' : '12px' }}
          tickFormatter={(value) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
            return `${(value / 1000).toFixed(0)}k`
          }}
          width={isMobile ? 35 : 60}
          tick={{ fontSize: isMobile ? '9px' : '12px' }}
          dx={isMobile ? -5 : 0}
        />
        <YAxis
          yAxisId="count"
          orientation="right"
          stroke="#a855f7"
          style={{ fontSize: isMobile ? '9px' : '12px' }}
          allowDecimals={false}
          width={isMobile ? 25 : 50}
          tick={{ fontSize: isMobile ? '9px' : '12px' }}
          dx={isMobile ? 5 : 0}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'white', 
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: isMobile ? '8px' : '10px',
            fontSize: isMobile ? '10px' : '12px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
          formatter={(value: number, name: string) => {
            if (name === 'wonAmount' || name === 'forecast') {
              return [`${value.toLocaleString('ru-RU')} ₽`, name === 'wonAmount' ? 'Выручка' : 'Прогноз']
            }
            return [value, name === 'total' ? 'Всего' : name === 'won' ? 'Закрыто успешно' : name === 'lost' ? 'Закрыто и не реализовано' : 'Активные']
          }}
        />
        <Legend 
          wrapperStyle={{ 
            fontSize: isMobile ? '10px' : '12px', 
            paddingTop: isMobile ? '8px' : '20px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: isMobile ? 'center' : 'flex-start',
            gap: isMobile ? '8px' : '16px'
          }}
          iconSize={isMobile ? 10 : 14}
          formatter={(value) => {
            const names: Record<string, string> = {
              wonAmount: isMobile ? 'Выручка' : 'Выручка (₽)',
              forecast: isMobile ? 'Прогноз' : 'Прогноз (₽)',
              total: isMobile ? 'Всего' : 'Всего сделок',
              won: isMobile ? 'Закрыто' : 'Закрыто успешно',
              lost: isMobile ? 'Не реализовано' : 'Закрыто и не реализовано',
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
          strokeWidth={isMobile ? 2.5 : 3}
          dot={{ r: isMobile ? 3 : 4, fill: '#22c55e' }}
          activeDot={{ r: isMobile ? 5 : 6 }}
        />
        <Line
          type="monotone"
          dataKey="forecast"
          yAxisId="amount"
          stroke="#6366f1"
          strokeWidth={isMobile ? 1.5 : 2}
          strokeDasharray="5 5"
          dot={{ r: isMobile ? 2 : 3, fill: '#6366f1' }}
          activeDot={{ r: isMobile ? 4 : 5 }}
        />
        <Line 
          type="monotone" 
          dataKey="total" 
          yAxisId="count"
          stroke="#a855f7" 
          strokeWidth={isMobile ? 1.5 : 2}
          dot={{ r: isMobile ? 3 : 4 }}
          activeDot={{ r: isMobile ? 5 : 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

