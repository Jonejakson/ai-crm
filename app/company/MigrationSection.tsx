'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

type MigrationSource = 'amocrm' | 'bitrix24' | null

const EXCEL_FIELD_OPTIONS = [
  { value: 'skip', label: '—' },
  { value: 'name', label: 'Имя' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Телефон' },
  { value: 'company', label: 'Компания' },
  { value: 'position', label: 'Должность' },
  { value: 'inn', label: 'ИНН' },
] as const

export default function MigrationSection() {
  const [source, setSource] = useState<MigrationSource>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<any>(null)

  // AmoCRM — только Excel, без API
  const [amoExcelFile, setAmoExcelFile] = useState<File | null>(null)
  const [amoExcelHeaders, setAmoExcelHeaders] = useState<string[]>([])
  const [amoColumnMapping, setAmoColumnMapping] = useState<Record<string, string>>({})

  // Bitrix24
  const [bitrixDomain, setBitrixDomain] = useState('')
  const [bitrixAccessToken, setBitrixAccessToken] = useState('')
  const [bitrixData, setBitrixData] = useState<any>(null)

  // Общие настройки
  const [defaultUserId, setDefaultUserId] = useState('')
  const [defaultPipelineId, setDefaultPipelineId] = useState('')
  const [defaultSourceId, setDefaultSourceId] = useState('')
  const [defaultDealTypeId, setDefaultDealTypeId] = useState('')

  const [users, setUsers] = useState<Array<{ id: number; name: string; email: string }>>([])
  const [pipelines, setPipelines] = useState<Array<{ id: number; name: string }>>([])
  const [dealSources, setDealSources] = useState<Array<{ id: number; name: string }>>([])
  const [dealTypes, setDealTypes] = useState<Array<{ id: number; name: string }>>([])

  // Загружаем данные для выпадающих списков
  useEffect(() => {
    fetchUsers()
    fetchPipelines()
    fetchDealSources()
    fetchDealTypes()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || data || [])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchPipelines = async () => {
    try {
      const response = await fetch('/api/pipelines')
      if (response.ok) {
        const data = await response.json()
        setPipelines(data.pipelines || data || [])
      }
    } catch (error) {
      console.error('Error fetching pipelines:', error)
    }
  }

  const fetchDealSources = async () => {
    try {
      const response = await fetch('/api/deal-sources')
      if (response.ok) {
        const data = await response.json()
        setDealSources(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching deal sources:', error)
    }
  }

  const fetchDealTypes = async () => {
    try {
      const response = await fetch('/api/deal-types')
      if (response.ok) {
        const data = await response.json()
        setDealTypes(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching deal types:', error)
    }
  }

  const handleAmoExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = event.target?.result as ArrayBuffer
        const workbook = XLSX.read(new Uint8Array(data), { type: 'array', cellDates: true })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) {
          toast.error('В файле нет листов')
          return
        }
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 }) as string[][]
        const headers = (rows[0] || []).map((h, i) => (h != null ? String(h).trim() : `Колонка ${i + 1}`))
        setAmoExcelFile(file)
        setAmoExcelHeaders(headers)
        setAmoColumnMapping({})
        toast.success('Файл загружен. Сопоставьте колонки.')
      } catch (err) {
        console.error(err)
        toast.error('Ошибка чтения Excel. Поддерживаются .xlsx и .xls.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleLoadBitrix24Data = async () => {
    if (!bitrixDomain || !bitrixAccessToken) {
      toast.error('Заполните domain и access token')
      return
    }

    setLoading(true)
    try {
      // В реальности здесь должен быть запрос к Bitrix24 API
      toast.success('Для импорта загрузите экспортированные данные из Bitrix24')
      // В продакшене здесь будет запрос к Bitrix24 API для получения данных
    } catch (error) {
      console.error('Error loading Bitrix24 data:', error)
      toast.error('Ошибка загрузки данных из Bitrix24')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, sourceType: MigrationSource) => {
    if (sourceType !== 'bitrix24') return
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string)
        setBitrixData(data)
        toast.success('Данные загружены')
      } catch (error) {
        toast.error('Ошибка чтения файла. Убедитесь, что это валидный JSON.')
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!source) {
      toast.error('Выберите источник данных')
      return
    }

    if (!defaultUserId) {
      toast.error('Выберите пользователя по умолчанию')
      return
    }

    setImporting(true)
    try {
      let response
      if (source === 'amocrm') {
        if (!amoExcelFile) {
          toast.error('Загрузите Excel-файл')
          setImporting(false)
          return
        }
        const formData = new FormData()
        formData.append('file', amoExcelFile)
        formData.append('columnMapping', JSON.stringify(amoColumnMapping))
        formData.append('defaultUserId', defaultUserId)
        response = await fetch('/api/migrations/amocrm/import-excel', {
          method: 'POST',
          body: formData,
        })
      } else if (source === 'bitrix24') {
        if (!bitrixData && (!bitrixDomain || !bitrixAccessToken)) {
          toast.error('Загрузите данные или укажите учетные данные')
          return
        }

        response = await fetch('/api/migrations/bitrix24', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain: bitrixDomain,
            accessToken: bitrixAccessToken,
            contacts: bitrixData?.contacts || [],
            deals: bitrixData?.deals || [],
            stages: bitrixData?.stages || [],
            defaultUserId,
            defaultPipelineId: defaultPipelineId || null,
            defaultSourceId: defaultSourceId || null,
            defaultDealTypeId: defaultDealTypeId || null,
          }),
        })
      }

      if (response && response.ok) {
        const data = await response.json()
        setResults(data.results)
        toast.success(data.message || 'Импорт завершен')
      } else {
        const error = await response?.json()
        toast.error(error.error || 'Ошибка импорта')
      }
    } catch (error) {
      console.error('Error importing:', error)
      toast.error('Ошибка импорта данных')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="card">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Миграция данных</h3>
        <p className="text-sm text-[var(--muted)]">
          Импортируйте данные в вашу CRM: из AmoCRM — загрузите Excel и сопоставьте колонки; из Bitrix24 — JSON или API.
        </p>
      </div>

      <div className="space-y-6">
        {/* Выбор источника */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Источник данных
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="source"
                value="amocrm"
                checked={source === 'amocrm'}
                onChange={() => setSource('amocrm')}
                className="w-4 h-4"
              />
              <span className="text-sm">AmoCRM</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="source"
                value="bitrix24"
                checked={source === 'bitrix24'}
                onChange={() => setSource('bitrix24')}
                className="w-4 h-4"
              />
              <span className="text-sm">Bitrix24</span>
            </label>
          </div>
        </div>

        {/* AmoCRM — загрузка Excel и сопоставление колонок */}
        {source === 'amocrm' && (
          <div className="space-y-4 p-4 bg-[var(--background-soft)] rounded-lg">
            <h4 className="text-sm font-semibold">Импорт из Excel (AmoCRM)</h4>
            <p className="text-xs text-[var(--muted)]">
              Выгрузите контакты из AmoCRM в Excel, загрузите файл сюда и сопоставьте колонки с полями CRM.
            </p>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Excel-файл
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleAmoExcelUpload}
                className="w-full text-sm"
              />
              {amoExcelFile && (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Файл: {amoExcelFile.name}
                </p>
              )}
            </div>

            {amoExcelHeaders.length > 0 && (
              <div className="border-t pt-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Сопоставление колонок
                </label>
                <p className="mb-3 text-xs text-[var(--muted)]">
                  Укажите, какое поле CRM соответствует каждой колонке вашего файла.
                </p>
                <div className="space-y-2">
                  {amoExcelHeaders.map((header, index) => (
                    <div key={index} className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-medium min-w-[120px]">
                        Колонка {index + 1}: {header || '(пусто)'}
                      </span>
                      <select
                        value={amoColumnMapping[String(index)] ?? 'skip'}
                        onChange={(e) => setAmoColumnMapping((prev) => ({ ...prev, [String(index)]: e.target.value }))}
                        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm min-w-[140px]"
                      >
                        {EXCEL_FIELD_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Настройки Bitrix24 */}
        {source === 'bitrix24' && (
          <div className="space-y-4 p-4 bg-[var(--background-soft)] rounded-lg">
            <h4 className="text-sm font-semibold">Настройки Bitrix24</h4>
            
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Domain
              </label>
              <input
                type="text"
                value={bitrixDomain}
                onChange={(e) => setBitrixDomain(e.target.value)}
                placeholder="yourcompany.bitrix24.ru"
                className="w-full"
              />
              <p className="mt-1 text-xs text-[var(--muted)]">
                Домен вашего Bitrix24
              </p>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Access Token
              </label>
              <input
                type="password"
                value={bitrixAccessToken}
                onChange={(e) => setBitrixAccessToken(e.target.value)}
                placeholder="Введите access token"
                className="w-full"
              />
              <p className="mt-1 text-xs text-[var(--muted)]">
                Получите токен в настройках Bitrix24 → Приложения → Вебхуки
              </p>
            </div>

            <div className="border-t pt-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Или загрузите экспортированные данные (JSON)
              </label>
              <input
                type="file"
                accept=".json"
                onChange={(e) => handleFileUpload(e, 'bitrix24')}
                className="w-full text-sm"
              />
            </div>
          </div>
        )}

        {/* Общие настройки */}
        {source && (
          <div className="space-y-4 p-4 bg-[var(--background-soft)] rounded-lg">
            <h4 className="text-sm font-semibold">Настройки импорта</h4>
            
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Пользователь по умолчанию *
              </label>
              <select
                value={defaultUserId}
                onChange={(e) => setDefaultUserId(e.target.value)}
                required
                className="w-full"
              >
                <option value="">Выберите пользователя</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--muted)]">
                К этому пользователю будут привязаны импортированные контакты и сделки
              </p>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Воронка по умолчанию
              </label>
              <select
                value={defaultPipelineId}
                onChange={(e) => setDefaultPipelineId(e.target.value)}
                className="w-full"
              >
                <option value="">Не указывать</option>
                {pipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Источник сделок по умолчанию
              </label>
              <select
                value={defaultSourceId}
                onChange={(e) => setDefaultSourceId(e.target.value)}
                className="w-full"
              >
                <option value="">Не указывать</option>
                {dealSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Тип сделок по умолчанию
              </label>
              <select
                value={defaultDealTypeId}
                onChange={(e) => setDefaultDealTypeId(e.target.value)}
                className="w-full"
              >
                <option value="">Не указывать</option>
                {dealTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Результаты */}
        {results && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h4 className="text-sm font-semibold mb-3">Результаты импорта</h4>
            <div className="space-y-2 text-sm">
              <div>
                <strong>Контакты:</strong> создано {results.contacts?.created ?? 0}, пропущено {results.contacts?.skipped ?? 0}
              </div>
              {results.deals != null && (
                <div>
                  <strong>Сделки:</strong> создано {results.deals.created}, пропущено {results.deals.skipped}
                </div>
              )}
              {results.pipelines && (
                <div>
                  <strong>Воронки:</strong> создано {results.pipelines.created}, пропущено {results.pipelines.skipped}
                </div>
              )}
              {((results.contacts?.errors?.length ?? 0) > 0 || (results.deals?.errors?.length ?? 0) > 0) && (
                <div className="mt-3 text-xs text-red-600">
                  <strong>Ошибки:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {(results.contacts?.errors ?? []).map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                    {(results.deals?.errors ?? []).map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Кнопка импорта */}
        {source && (
          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={handleImport}
              disabled={importing || !defaultUserId || (source === 'amocrm' && !amoExcelFile)}
              className="btn-primary"
            >
              {importing ? 'Импорт...' : 'Начать импорт'}
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-[var(--background-soft)] rounded-lg">
        <h4 className="text-sm font-semibold mb-2">Инструкция:</h4>
        <ol className="text-sm text-[var(--muted)] space-y-1 list-decimal list-inside">
          <li><strong>AmoCRM:</strong> выгрузите контакты в Excel → загрузите файл → сопоставьте колонки (Имя, Email, Телефон и т.д.) → выберите пользователя → «Начать импорт»</li>
          <li><strong>Bitrix24:</strong> укажите учётные данные или загрузите JSON → настройте импорт → «Начать импорт»</li>
          <li>Дубликаты контактов (по email или телефону) пропускаются автоматически</li>
        </ol>
        <p className="mt-3 text-xs text-[var(--muted)]">
          <strong>Примечание:</strong> Дубликаты контактов (по email или телефону) будут пропущены автоматически.
        </p>
      </div>
    </div>
  )
}

