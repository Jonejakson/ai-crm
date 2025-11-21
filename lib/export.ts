// Утилиты для экспорта данных в CSV и Excel

// Конвертация данных в CSV формат
export function convertToCSV(data: any[], headers: string[], fields: string[]): string {
  // BOM для корректного отображения кириллицы в Excel
  const BOM = '\uFEFF'
  
  // Заголовки
  const csvHeaders = headers.join(',')
  
  // Данные
  const csvRows = data.map(row => {
    return fields.map(field => {
      const value = getNestedValue(row, field)
      // Экранируем кавычки и оборачиваем в кавычки, если содержит запятую или перенос строки
      if (value === null || value === undefined) return ''
      const stringValue = String(value)
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }).join(',')
  })
  
  return BOM + [csvHeaders, ...csvRows].join('\n')
}

// Получение вложенного значения по пути (например, 'contact.name')
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, prop) => current?.[prop], obj) ?? ''
}

// Скачивание файла
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

// Генерация Excel-совместимого CSV (с BOM для UTF-8)
export function generateExcelCSV(data: any[], headers: string[], fields: string[]): string {
  return convertToCSV(data, headers, fields)
}

// Форматирование даты для экспорта
export function formatDateForExport(date: string | null | undefined): string {
  if (!date) return ''
  try {
    const d = new Date(date)
    return d.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  } catch {
    return ''
  }
}

// Форматирование даты и времени для экспорта
export function formatDateTimeForExport(date: string | null | undefined): string {
  if (!date) return ''
  try {
    const d = new Date(date)
    return d.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return ''
  }
}




