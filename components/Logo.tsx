'use client'

const FlameIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <defs>
      <linearGradient id="flame-green" x1="20" y1="4" x2="20" y2="36" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#34d399" />
        <stop offset="0.55" stopColor="#22c55e" />
        <stop offset="1" stopColor="#15803d" />
      </linearGradient>
      <linearGradient id="flame-green-glow" x1="20" y1="12" x2="20" y2="34" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#ecfdf3" stopOpacity="0.9" />
        <stop offset="1" stopColor="#bbf7d0" stopOpacity="0.25" />
      </linearGradient>
    </defs>
    <path
      d="M22 5c2.5 3 3.5 6.3 2.8 9.4-.5 2.1-1.9 4-1.2 5.9.7 1.9 3.1 2.9 3.1 5.8 0 4.3-3.8 7.9-8.7 7.9-4.9 0-8.7-3.6-8.7-8.1 0-5.5 4.6-7.1 6.5-11.1.9-1.9.8-3.8.1-5.8-.6-1.7-.1-3.6 1.3-5.3 1.6-1.8 4-3 4.8 1.3Z"
      fill="url(#flame-green)"
    />
    <path
      d="M21 13c1.3 1.6 2 3.4 1.4 5.2-.4 1.3-1.3 2.7-.8 3.9.5 1.2 2 1.8 2 3.7 0 2.7-2.4 5-5.3 5-3 0-5.3-2.2-5.3-5.1 0-3.5 2.8-4.6 4-7.1.6-1.2.5-2.4.1-3.7-.4-1.1-.1-2.3.8-3.4 1-1.2 2.5-2 3.1 1.5Z"
      fill="url(#flame-green-glow)"
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
        Flame CRM
      </span>
    )
  }

  // Full logo - в одну строку
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={currentSize.icon}>
        <FlameIcon />
      </div>
      <span className={`font-bold ${currentSize.text} text-[var(--foreground)] tracking-tight`}>
        Flame CRM
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

