'use client'

interface LogoProps {
  variant?: 'full' | 'icon' | 'text'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  style?: 'single' | 'double' // Одиночное или двойное крыло
}

export default function Logo({ variant = 'full', size = 'md', className = '', style = 'double' }: LogoProps) {
  const sizeClasses = {
    sm: { icon: 'w-6 h-6', text: 'text-sm' },
    md: { icon: 'w-8 h-8', text: 'text-base' },
    lg: { icon: 'w-10 h-10', text: 'text-lg' }
  }

  const currentSize = sizeClasses[size]

  // Aero CRM - логотип в стиле крыла
  const WingIcon = () => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="aero-gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#047857" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="aero-gradient2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="aero-gradient3" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
          <stop offset="100%" stopColor="#047857" stopOpacity="1" />
        </linearGradient>
      </defs>
      {style === 'single' ? (
        // Одиночное крыло
        <path
          d="M4 20C4 20 8 12 16 12C24 12 28 20 28 20"
          stroke="url(#aero-gradient1)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ) : (
        // Двойное крыло
        <>
          <path
            d="M4 18C4 18 8 10 16 10C24 10 28 18 28 18"
            stroke="url(#aero-gradient2)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M4 22C4 22 8 14 16 14C24 14 28 22 28 22"
            stroke="url(#aero-gradient3)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      )}
    </svg>
  )

  if (variant === 'icon') {
    return (
      <div className={`${currentSize.icon} ${className}`}>
        <WingIcon />
      </div>
    )
  }

  if (variant === 'text') {
    return (
      <div className={`flex flex-col ${className}`}>
        <span className={`font-semibold ${currentSize.text} text-[var(--foreground)]`}>
          Aero
        </span>
        <span className={`font-semibold ${currentSize.text} text-[var(--foreground)]`}>
          CRM
        </span>
      </div>
    )
  }

  // Full logo
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={currentSize.icon}>
        <WingIcon />
      </div>
      <div className="flex flex-col">
        <span className={`font-semibold ${currentSize.text} text-[var(--foreground)] leading-tight`}>
          Aero
        </span>
        <span className={`font-semibold ${currentSize.text} text-[var(--foreground)] leading-tight`}>
          CRM
        </span>
      </div>
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

