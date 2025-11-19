'use client'

interface LogoProps {
  variant?: 'full' | 'icon' | 'text'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function Logo({ variant = 'full', size = 'md', className = '' }: LogoProps) {
  const sizeClasses = {
    sm: { icon: 'w-6 h-6', text: 'text-base' },
    md: { icon: 'w-8 h-8', text: 'text-lg' },
    lg: { icon: 'w-10 h-10', text: 'text-xl' }
  }

  const currentSize = sizeClasses[size]

  // Вариант 1: FlowCRM - волна/поток
  if (variant === 'icon') {
    return (
      <div className={`${currentSize.icon} ${className}`}>
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M8 20C8 20 12 16 20 16C28 16 32 20 32 20C32 20 28 24 20 24C12 24 8 20 8 20Z"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--primary)]"
          />
          <path
            d="M8 20C8 20 10 18 15 18C20 18 22 20 22 20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-[var(--primary)] opacity-60"
          />
          <path
            d="M32 20C32 20 30 22 25 22C20 22 18 20 18 20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-[var(--primary)] opacity-60"
          />
        </svg>
      </div>
    )
  }

  if (variant === 'text') {
    return (
      <span className={`font-semibold ${currentSize.text} text-[var(--foreground)] ${className}`}>
        FlowCRM
      </span>
    )
  }

  // Full logo
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={currentSize.icon}>
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M8 20C8 20 12 16 20 16C28 16 32 20 32 20C32 20 28 24 20 24C12 24 8 20 8 20Z"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--primary)]"
          />
          <path
            d="M8 20C8 20 10 18 15 18C20 18 22 20 22 20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-[var(--primary)] opacity-60"
          />
          <path
            d="M32 20C32 20 30 22 25 22C20 22 18 20 18 20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-[var(--primary)] opacity-60"
          />
        </svg>
      </div>
      <span className={`font-semibold ${currentSize.text} text-[var(--foreground)]`}>
        FlowCRM
      </span>
    </div>
  )
}

// Альтернативный вариант логотипа - GreenHub
export function GreenHubLogo({ variant = 'full', size = 'md', className = '' }: LogoProps) {
  const sizeClasses = {
    sm: { icon: 'w-6 h-6', text: 'text-base' },
    md: { icon: 'w-8 h-8', text: 'text-lg' },
    lg: { icon: 'w-10 h-10', text: 'text-xl' }
  }

  const currentSize = sizeClasses[size]

  if (variant === 'icon') {
    return (
      <div className={`${currentSize.icon} ${className}`}>
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="8" fill="currentColor" className="text-[var(--primary)]" />
          <path
            d="M20 12L20 8M20 32L20 28M12 20L8 20M32 20L28 20M15.757 15.757L13.636 13.636M26.364 26.364L24.243 24.243M15.757 24.243L13.636 26.364M26.364 13.636L24.243 15.757"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-[var(--primary)] opacity-40"
          />
        </svg>
      </div>
    )
  }

  if (variant === 'text') {
    return (
      <span className={`font-semibold ${currentSize.text} text-[var(--foreground)] ${className}`}>
        GreenHub
      </span>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={currentSize.icon}>
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="8" fill="currentColor" className="text-[var(--primary)]" />
          <path
            d="M20 12L20 8M20 32L20 28M12 20L8 20M32 20L28 20M15.757 15.757L13.636 13.636M26.364 26.364L24.243 24.243M15.757 24.243L13.636 26.364M26.364 13.636L24.243 15.757"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-[var(--primary)] opacity-40"
          />
        </svg>
      </div>
      <span className={`font-semibold ${currentSize.text} text-[var(--foreground)]`}>
        GreenHub
      </span>
    </div>
  )
}

// Вариант 3: Nexus - связанные узлы
export function NexusLogo({ variant = 'full', size = 'md', className = '' }: LogoProps) {
  const sizeClasses = {
    sm: { icon: 'w-6 h-6', text: 'text-base' },
    md: { icon: 'w-8 h-8', text: 'text-lg' },
    lg: { icon: 'w-10 h-10', text: 'text-xl' }
  }

  const currentSize = sizeClasses[size]

  if (variant === 'icon') {
    return (
      <div className={`${currentSize.icon} ${className}`}>
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="12" r="4" fill="currentColor" className="text-[var(--primary)]" />
          <circle cx="12" cy="28" r="4" fill="currentColor" className="text-[var(--primary)]" />
          <circle cx="28" cy="28" r="4" fill="currentColor" className="text-[var(--primary)]" />
          <path
            d="M20 16L12 24M20 16L28 24M12 24L28 24"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-[var(--primary)] opacity-50"
          />
        </svg>
      </div>
    )
  }

  if (variant === 'text') {
    return (
      <span className={`font-semibold ${currentSize.text} text-[var(--foreground)] ${className}`}>
        Nexus
      </span>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={currentSize.icon}>
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="12" r="4" fill="currentColor" className="text-[var(--primary)]" />
          <circle cx="12" cy="28" r="4" fill="currentColor" className="text-[var(--primary)]" />
          <circle cx="28" cy="28" r="4" fill="currentColor" className="text-[var(--primary)]" />
          <path
            d="M20 16L12 24M20 16L28 24M12 24L28 24"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-[var(--primary)] opacity-50"
          />
        </svg>
      </div>
      <span className={`font-semibold ${currentSize.text} text-[var(--foreground)]`}>
        Nexus CRM
      </span>
    </div>
  )
}

