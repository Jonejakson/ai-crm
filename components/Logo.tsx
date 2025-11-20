'use client'

const EnvelopeIcon = () => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="pocket-envelope-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="pocket-envelope-shadow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0f172a" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="6" y="8" width="28" height="24" rx="10" fill="url(#pocket-envelope-shadow)" opacity="0.35" />
      <rect x="8" y="10" width="24" height="20" rx="8" fill="url(#pocket-envelope-gradient)" />
      <path
        d="M9.5 13L20 21L30.5 13"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
      <path
        d="M11 26L16.5 20.5"
        stroke="white"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M29 26L23.5 20.5"
        stroke="white"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.8"
      />
      <circle cx="28" cy="15" r="2" fill="white" opacity="0.85" />
      <path
        d="M12 18C16 21 24 21 28 18"
        stroke="white"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  )

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

  if (variant === 'icon') {
    return (
      <div className={`${currentSize.icon} ${className}`}>
        <EnvelopeIcon />
      </div>
    )
  }

  if (variant === 'text') {
    return (
      <span className={`font-bold ${currentSize.text} text-[var(--foreground)] ${className}`}>
        Pocket CRM
      </span>
    )
  }

  // Full logo - в одну строку
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={currentSize.icon}>
        <EnvelopeIcon />
      </div>
      <span className={`font-bold ${currentSize.text} text-[var(--foreground)] tracking-tight`}>
        Pocket CRM
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

