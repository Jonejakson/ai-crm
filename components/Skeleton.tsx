'use client'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave' | 'none'
}

export default function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const baseClasses = 'bg-gray-200 dark:bg-gray-700'
  
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  }

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-\[shimmer_2s_infinite\]',
    none: '',
  }

  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  )
}

// Готовые компоненты для частых случаев
export function SkeletonCard() {
  return (
    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
      <Skeleton variant="text" width="60%" height={20} />
      <Skeleton variant="text" width="100%" height={16} />
      <Skeleton variant="text" width="80%" height={16} />
    </div>
  )
}

export function SkeletonTable() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-4">
          <Skeleton variant="rectangular" width="30%" height={40} />
          <Skeleton variant="rectangular" width="40%" height={40} />
          <Skeleton variant="rectangular" width="30%" height={40} />
        </div>
      ))}
    </div>
  )
}

export function SkeletonList() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton variant="circular" width={40} height={40} />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width="40%" height={16} />
            <Skeleton variant="text" width="60%" height={14} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonKanban() {
  return (
    <div className="flex gap-4 overflow-x-auto">
      {[1, 2, 3, 4].map((col) => (
        <div key={col} className="flex-shrink-0 w-72 space-y-3">
          <Skeleton variant="rectangular" width="100%" height={50} />
          {[1, 2, 3].map((card) => (
            <SkeletonCard key={card} />
          ))}
        </div>
      ))}
    </div>
  )
}

