'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface SearchResult {
  contacts: Array<{
    id: number
    name: string
    email: string
    phone: string | null
    company: string | null
  }>
  tasks: Array<{
    id: number
    title: string
    status: string
    contact: {
      id: number
      name: string
      email: string
    } | null
  }>
  deals: Array<{
    id: number
    title: string
    amount: number
    currency: string
    stage: string
    contact: {
      id: number
      name: string
      email: string
    }
  }>
  events: Array<{
    id: number
    title: string
    startDate: string
    type: string
    contact: {
      id: number
      name: string
      email: string
    } | null
  }>
}

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (query.trim().length >= 2) {
      const timeoutId = setTimeout(() => {
        performSearch(query)
      }, 300)

      return () => clearTimeout(timeoutId)
    } else {
      setResults(null)
      setIsOpen(false)
    }
  }, [query])

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults(null)
      setIsOpen(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
      if (response.ok) {
        const data = await response.json()
        console.log('Search results:', data) // Для отладки
        setResults(data)
        setIsOpen(true)
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Search error:', response.status, response.statusText, errorData)
        setResults(null)
        setIsOpen(false)
      }
    } catch (error) {
      console.error('Error searching:', error)
      setResults(null)
      setIsOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const getTotalResults = () => {
    if (!results) return 0
    return results.contacts.length + results.tasks.length + results.deals.length + results.events.length
  }

  const handleResultClick = (type: string, id: number) => {
    setIsOpen(false)
    setQuery('')
    
    switch (type) {
      case 'contact':
        router.push(`/contacts/${id}`)
        break
      case 'task':
        router.push(`/tasks`)
        break
      case 'deal':
        router.push(`/deals`)
        break
      case 'event':
        router.push(`/calendar`)
        break
    }
  }

  return (
    <div className="relative w-full max-w-2xl" ref={searchRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results && getTotalResults() > 0) {
              setIsOpen(true)
            }
          }}
          placeholder="Поиск по контактам, задачам, сделкам, событиям..."
          className="w-full px-4 py-2 pl-10 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <div className="absolute left-3 top-2.5 text-gray-400">
          🔍
        </div>
        {loading && (
          <div className="absolute right-3 top-2.5">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {isOpen && results && getTotalResults() > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {/* Контакты */}
          {results.contacts.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                Контакты ({results.contacts.length})
              </div>
              {results.contacts.map(contact => (
                <div
                  key={contact.id}
                  onClick={() => handleResultClick('contact', contact.id)}
                  className="px-3 py-2 hover:bg-gray-50 cursor-pointer rounded"
                >
                  <div className="font-medium text-gray-900">{contact.name}</div>
                  <div className="text-sm text-gray-500">{contact.email}</div>
                  {contact.company && (
                    <div className="text-xs text-gray-400">{contact.company}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Задачи */}
          {results.tasks.length > 0 && (
            <div className="p-2 border-t">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                Задачи ({results.tasks.length})
              </div>
              {results.tasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => handleResultClick('task', task.id)}
                  className="px-3 py-2 hover:bg-gray-50 cursor-pointer rounded"
                >
                  <div className="font-medium text-gray-900">{task.title}</div>
                  <div className="text-sm text-gray-500">
                    Статус: {task.status}
                    {task.contact && ` • ${task.contact.name}`}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Сделки */}
          {results.deals.length > 0 && (
            <div className="p-2 border-t">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                Сделки ({results.deals.length})
              </div>
              {results.deals.map(deal => (
                <div
                  key={deal.id}
                  onClick={() => handleResultClick('deal', deal.id)}
                  className="px-3 py-2 hover:bg-gray-50 cursor-pointer rounded"
                >
                  <div className="font-medium text-gray-900">{deal.title}</div>
                  <div className="text-sm text-gray-500">
                    {deal.amount.toLocaleString('ru-RU')} {deal.currency} • {deal.stage}
                    {deal.contact && ` • ${deal.contact.name}`}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* События */}
          {results.events.length > 0 && (
            <div className="p-2 border-t">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                События ({results.events.length})
              </div>
              {results.events.map(event => {
                const startDate = new Date(event.startDate)
                return (
                  <div
                    key={event.id}
                    onClick={() => handleResultClick('event', event.id)}
                    className="px-3 py-2 hover:bg-gray-50 cursor-pointer rounded"
                  >
                    <div className="font-medium text-gray-900">{event.title}</div>
                    <div className="text-sm text-gray-500">
                      {startDate.toLocaleString('ru-RU', { 
                        day: 'numeric', 
                        month: 'long', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })} • {event.type}
                      {event.contact && ` • ${event.contact.name}`}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {isOpen && results && getTotalResults() === 0 && query.trim().length >= 2 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
          Ничего не найдено
        </div>
      )}
    </div>
  )
}

