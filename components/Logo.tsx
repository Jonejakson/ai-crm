'use client'

interface LogoProps {
  variant?: 'full' | 'icon' | 'text'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function Logo({ variant = 'full', size = 'md', className = '' }: LogoProps) {
  const sizeClasses = {
    sm: { icon: 'w-5 h-5', text: 'text-sm' },
    md: { icon: 'w-7 h-7', text: 'text-base' },
    lg: { icon: 'w-9 h-9', text: 'text-lg' }
  }

  const currentSize = sizeClasses[size]

  // Стильный современный логотип - абстрактная форма с градиентом
  const ModernIcon = () => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="modern-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#059669" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>
      {/* Современная абстрактная форма */}
      <path
        d="M8 20C8 12 14 8 20 8C26 8 32 12 32 20C32 28 26 32 20 32C14 32 8 28 8 20Z"
        fill="url(#modern-gradient)"
        opacity="0.2"
      />
      <path
        d="M12 20C12 15 15 12 20 12C25 12 28 15 28 20C28 25 25 28 20 28C15 28 12 25 12 20Z"
        fill="url(#modern-gradient)"
      />
      <path
        d="M16 20C16 17 17.5 16 20 16C22.5 16 24 17 24 20C24 23 22.5 24 20 24C17.5 24 16 23 16 20Z"
        fill="white"
        opacity="0.3"
      />
    </svg>
  )

  if (variant === 'icon') {
    return (
      <div className={`${currentSize.icon} ${className}`}>
        <ModernIcon />
      </div>
    )
  }

  if (variant === 'text') {
    return (
      <span className={`font-bold ${currentSize.text} text-[var(--foreground)] ${className}`}>
        aerocrm
      </span>
    )
  }

  // Full logo - в одну строку
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={currentSize.icon}>
        <ModernIcon />
      </div>
      <span className={`font-bold ${currentSize.text} text-[var(--foreground)] tracking-tight`}>
        aerocrm
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

