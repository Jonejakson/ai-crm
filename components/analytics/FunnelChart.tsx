'use client'

import { useState, useRef } from 'react'

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
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  
  const chartData = stages.map((stage, index) => ({
    name: stage.name,
    count: stage.count,
    amount: stage.amount,
    conversion: stage.conversion || 0,
    color: colors[index % colors.length],
  }))

  // Функция для разбиения длинных названий на две строки
  const splitLabel = (text: string, maxLength: number = 20): string[] => {
    if (text.length <= maxLength) return [text]
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''
    
    for (const word of words) {
      if ((currentLine + ' ' + word).length <= maxLength) {
        currentLine = currentLine ? currentLine + ' ' + word : word
      } else {
        if (currentLine) lines.push(currentLine)
        currentLine = word
      }
    }
    if (currentLine) lines.push(currentLine)
    
    return lines.length > 0 ? lines : [text]
  }

  const maxValue = Math.max(...chartData.map(d => d.count), 1)
  const chartWidth = 800
  // Уменьшаем отступы сверху, увеличиваем снизу для оси X
  const margin = { top: 5, right: 30, bottom: 0, left: 180 }
  const barHeight = 28
  const barGap = 8
  const plotWidth = chartWidth - margin.left - margin.right
  
  // Вычисляем высоту области для баров (без оси X)
  const barsAreaHeight = chartData.length * (barHeight + barGap) - barGap
  const plotHeight = barsAreaHeight
  
  // X-axis размещаем на 15px ниже области баров
  const xAxisY = margin.top + plotHeight + 15
  
  // Общая высота SVG = область баров + отступ сверху + место для оси X
  const chartHeight = margin.top + plotHeight + 50 // 50px для оси X и подписей

  const handleBarMouseEnter = (e: React.MouseEvent<SVGRectElement>, stage: typeof chartData[0]) => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        text: `Количество сделок: ${stage.count}`
      })
    }
  }

  const handleBarMouseLeave = () => {
    setTooltip(null)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">{pipelineName}</h3>
      <div className="w-full overflow-x-auto">
        <svg 
          ref={svgRef}
          width={chartWidth} 
          height={chartHeight}
          className="w-full"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines */}
          {[0, 1, 2, 3, 4, 5].map(tick => {
            const x = margin.left + (tick / 5) * plotWidth
            return (
              <line
                key={tick}
                x1={x}
                y1={margin.top}
                x2={x}
                y2={margin.top + plotHeight}
                stroke="#e5e7eb"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            )
          })}

          {/* Bars */}
          {chartData.map((stage, index) => {
            const y = margin.top + index * (barHeight + barGap)
            const barWidth = (stage.count / maxValue) * plotWidth
            const x = margin.left
            
            return (
              <g key={stage.name}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={stage.color}
                  rx={8}
                  onMouseEnter={(e) => handleBarMouseEnter(e, stage)}
                  onMouseLeave={handleBarMouseLeave}
                  className="cursor-pointer"
                />
              </g>
            )
          })}

          {/* Y-axis labels */}
          {chartData.map((stage, index) => {
            const y = margin.top + index * (barHeight + barGap) + barHeight / 2
            const labelLines = splitLabel(stage.name, 18)
            const lineHeight = 14
            const startY = y - ((labelLines.length - 1) * lineHeight) / 2
            
            return (
              <g key={stage.name}>
                {labelLines.map((line, lineIndex) => (
                  <text
                    key={lineIndex}
                    x={margin.left - 15}
                    y={startY + lineIndex * lineHeight}
                    textAnchor="end"
                    fontSize="13"
                    fill="#374151"
                    fontWeight="500"
                    dominantBaseline="middle"
                  >
                    {line}
                  </text>
                ))}
              </g>
            )
          })}

          {/* X-axis - вынесена за пределы графика */}
          <line
            x1={margin.left}
            y1={xAxisY}
            x2={margin.left + plotWidth}
            y2={xAxisY}
            stroke="#6b7280"
            strokeWidth={1}
          />

          {/* X-axis ticks and labels */}
          {[0, 1, 2, 3, 4, 5].map(tick => {
            const x = margin.left + (tick / 5) * plotWidth
            const value = Math.round((tick / 5) * maxValue)
            return (
              <g key={tick}>
                <line
                  x1={x}
                  y1={xAxisY}
                  x2={x}
                  y2={xAxisY + 5}
                  stroke="#6b7280"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={xAxisY + 20}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#6b7280"
                >
                  {value}
                </text>
              </g>
            )
          })}

          {/* X-axis label */}
          <text
            x={margin.left + plotWidth / 2}
            y={xAxisY + 40}
            textAnchor="middle"
            fontSize="12"
            fill="#6b7280"
          >
            Количество
          </text>

          {/* Tooltip */}
          {tooltip && (
            <g>
              <rect
                x={tooltip.x - 60}
                y={tooltip.y - 30}
                width={120}
                height={24}
                fill="white"
                stroke="#e5e7eb"
                strokeWidth={1}
                rx={8}
              />
              <text
                x={tooltip.x}
                y={tooltip.y - 12}
                textAnchor="middle"
                fontSize="11"
                fill="#1f2937"
              >
                {tooltip.text}
              </text>
            </g>
          )}
        </svg>
      </div>
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

