 'use client'
 
 import { useEffect, useMemo, useRef, useState } from 'react'
 import { createPortal } from 'react-dom'
 
 type Option = { value: string; label: string }
 
 export function CustomSelect({
   value,
   onChange,
   options,
   placeholder = 'Выберите...',
   required = false,
   maxHeight = 256,
 }: {
   value: string
   onChange: (value: string) => void
   options: Option[]
   placeholder?: string
   required?: boolean
   maxHeight?: number
 }) {
   const [isOpen, setIsOpen] = useState(false)
   const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })
   const buttonRef = useRef<HTMLButtonElement>(null)
   const dropdownRef = useRef<HTMLDivElement>(null)
 
   const displayText = useMemo(() => {
     return options.find((opt) => opt.value === value)?.label || placeholder
   }, [options, placeholder, value])
 
   useEffect(() => {
     const updatePosition = () => {
       const btn = buttonRef.current
       if (!btn) return
 
       const rect = btn.getBoundingClientRect()
       const viewportH = window.innerHeight
       const viewportW = window.innerWidth
       const gap = 8
       const padding = 16
 
       const spaceBelow = viewportH - rect.bottom
       const spaceAbove = rect.top
       const openUp = spaceBelow < 140 && spaceAbove > spaceBelow
 
       const dropdownH = maxHeight
       let top = openUp ? rect.top - dropdownH - gap : rect.bottom + gap
       top = Math.max(padding, Math.min(viewportH - dropdownH - padding, top))
 
       let left = rect.left
       left = Math.max(padding, Math.min(viewportW - rect.width - padding, left))
 
       setPosition({ top, left, width: rect.width })
     }
 
     if (!isOpen) return
     updatePosition()
     const t = setTimeout(updatePosition, 0)
     window.addEventListener('resize', updatePosition)
     window.addEventListener('scroll', updatePosition, true)
     return () => {
       clearTimeout(t)
       window.removeEventListener('resize', updatePosition)
       window.removeEventListener('scroll', updatePosition, true)
     }
   }, [isOpen, maxHeight])
 
   useEffect(() => {
     const handleClickOutside = (event: MouseEvent) => {
       const target = event.target as Node
       if (dropdownRef.current?.contains(target)) return
       if (buttonRef.current?.contains(target)) return
       setIsOpen(false)
     }
 
     if (!isOpen) return
     const t = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0)
     return () => {
       clearTimeout(t)
       document.removeEventListener('mousedown', handleClickOutside)
     }
   }, [isOpen])
 
   const handleSelect = (optionValue: string) => {
     onChange(optionValue)
     setIsOpen(false)
   }
 
   const dropdown = isOpen ? (
     <div
       ref={dropdownRef}
       className="fixed rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl p-2 space-y-1 overflow-y-auto"
       style={{
         top: `${position.top}px`,
         left: `${position.left}px`,
         width: `${position.width}px`,
         maxHeight: `${maxHeight}px`,
         zIndex: 100000,
       }}
       role="listbox"
     >
       {options.map((option) => {
         const isSelected = value === option.value
         return (
           <button
             key={option.value}
             type="button"
             onClick={() => handleSelect(option.value)}
             className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200 min-h-[44px] flex items-center ${
               isSelected
                 ? 'bg-[var(--primary-soft)] text-[var(--primary)] font-semibold'
                 : 'hover:bg-[var(--background-soft)] text-[var(--foreground)] active:bg-[var(--primary-soft)]'
             }`}
             role="option"
             aria-selected={isSelected}
           >
             {option.label}
           </button>
         )
       })}
     </div>
   ) : null
 
   return (
     <>
       <div className="relative w-full">
         <button
           ref={buttonRef}
           type="button"
           onClick={() => setIsOpen((v) => !v)}
           aria-haspopup="listbox"
           aria-expanded={isOpen}
           className={`w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--muted-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all duration-300 text-left flex items-center justify-between min-h-[44px] ${
             !value ? 'text-[var(--muted-soft)]' : ''
           } ${isOpen ? 'ring-2 ring-[var(--primary)] border-[var(--primary)]' : ''}`}
           style={{ boxShadow: isOpen ? 'var(--shadow-md)' : 'var(--shadow-sm)' }}
         >
           <span className="truncate text-sm md:text-base">{displayText}</span>
           <span
             className={`transition-transform duration-200 ml-2 flex-shrink-0 text-[var(--muted)] ${
               isOpen ? 'rotate-180' : ''
             }`}
           >
             ▼
           </span>
         </button>
 
         {required && (
           <select
             required
             value={value}
             onChange={() => {}}
             className="absolute opacity-0 pointer-events-none w-0 h-0"
             tabIndex={-1}
             aria-hidden="true"
           >
             {options.map((opt) => (
               <option key={opt.value} value={opt.value}>
                 {opt.label}
               </option>
             ))}
           </select>
         )}
       </div>
 
       {typeof window !== 'undefined' && createPortal(dropdown, document.body)}
     </>
   )
 }
 
