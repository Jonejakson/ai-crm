import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'

// API для поиска компании по ИНН
// Используем бесплатный API daData.ru или можно заменить на другой сервис
export async function GET(request: Request) {
  try {
    // Проверка авторизации
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const inn = searchParams.get('inn')

    if (!inn) {
      return NextResponse.json(
        { error: 'ИНН не указан' },
        { status: 400 }
      )
    }

    // Валидация ИНН (10 или 12 цифр)
    const cleanInn = inn.replace(/\D/g, '')
    if (cleanInn.length !== 10 && cleanInn.length !== 12) {
      return NextResponse.json(
        { error: 'ИНН должен содержать 10 или 12 цифр' },
        { status: 400 }
      )
    }

    // Используем API daData.ru (требуется API ключ в переменных окружения)
    // Документация: https://dadata.ru/api/find-party/
    const apiKey = process.env.DADATA_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { 
          error: 'API ключ не настроен',
          message: 'Настройте DADATA_API_KEY в переменных окружения для использования поиска по ИНН. Получить ключ можно на https://dadata.ru/'
        },
        { status: 503 }
      )
    }

    // Запрос к daData API методом findById для поиска организации по ИНН
    // Документация: https://dadata.ru/api/find-party/
    const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Token ${apiKey}`,
      },
      body: JSON.stringify({
        query: cleanInn,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = 'Ошибка при запросе к API'
      
      // Пытаемся распарсить ошибку от daData
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.message || errorData.detail || errorMessage
      } catch {
        // Если не удалось распарсить, используем текст ошибки
        if (errorText) {
          errorMessage = errorText
        }
      }
      
      console.error('daData API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        apiKeyLength: apiKey?.length,
        apiKeyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : 'missing'
      })
      
      // Специальная обработка для 403 - возможно проблема с ключом
      if (response.status === 403) {
        return NextResponse.json(
          { 
            error: 'Доступ запрещен. Проверьте правильность API ключа DADATA_API_KEY в настройках Vercel.',
            details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
          },
          { status: 403 }
        )
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: process.env.NODE_ENV === 'development' ? errorText : undefined
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (!data.suggestions || data.suggestions.length === 0) {
      return NextResponse.json(
        { error: 'Компания с таким ИНН не найдена' },
        { status: 404 }
      )
    }

    const company = data.suggestions[0].data

    return NextResponse.json({
      name: company.name?.full_with_opf || company.name?.short_with_opf || company.name?.full || '',
      inn: company.inn || cleanInn,
      kpp: company.kpp || '',
      ogrn: company.ogrn || '',
      address: company.address?.value || '',
      management: company.management?.name || '',
      okved: company.okved || '',
    })
  } catch (error: any) {
    console.error('Error fetching company by INN:', error)
    return NextResponse.json(
      { error: 'Ошибка при поиске компании' },
      { status: 500 }
    )
  }
}

