import { NextResponse } from 'next/server'

// API для поиска компании по ИНН
// Используем бесплатный API daData.ru или можно заменить на другой сервис
export async function GET(request: Request) {
  try {
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
    // Если ключа нет, можно использовать альтернативные сервисы
    const apiKey = process.env.DADATA_API_KEY
    const apiSecret = process.env.DADATA_SECRET_KEY

    if (!apiKey || !apiSecret) {
      // Если нет API ключа, возвращаем заглушку или используем альтернативный сервис
      // Можно использовать API ФНС напрямую (но там нужна регистрация)
      return NextResponse.json(
        { 
          error: 'API ключ не настроен',
          message: 'Настройте DADATA_API_KEY и DADATA_SECRET_KEY в переменных окружения для использования поиска по ИНН'
        },
        { status: 503 }
      )
    }

    // Запрос к daData API
    const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${apiKey}`,
        'X-Secret': apiSecret,
      },
      body: JSON.stringify({
        query: cleanInn,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('daData API error:', errorText)
      return NextResponse.json(
        { error: 'Ошибка при запросе к API' },
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

