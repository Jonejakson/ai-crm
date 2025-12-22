import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/get-session'
import { fetchCompanyByInnFromChecko, fetchCompanyByInnFromFns } from '@/lib/company/checko-parser'

// API для поиска компании по ИНН
// Используем парсер checko.ru (бесплатно) или API ФНС как fallback
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

    // Пробуем сначала checko.ru (бесплатный парсинг)
    try {
      const companyData = await fetchCompanyByInnFromChecko(cleanInn)
      
      if (companyData && companyData.name) {
        return NextResponse.json({
          name: companyData.name,
          inn: companyData.inn || cleanInn,
          kpp: companyData.kpp || '',
          ogrn: companyData.ogrn || '',
          address: companyData.address || '',
          management: companyData.management || '',
          okved: companyData.okved || '',
        })
      }
    } catch (checkoError: any) {
      console.warn('Checko parser failed, trying fallback:', checkoError.message)
    }

    // Fallback: пробуем API ФНС (если настроен ключ)
    const fnsApiKey = process.env.FNS_API_KEY
    if (fnsApiKey) {
      try {
        const companyData = await fetchCompanyByInnFromFns(cleanInn, fnsApiKey)
        
        if (companyData && companyData.name) {
          return NextResponse.json({
            name: companyData.name,
            inn: companyData.inn || cleanInn,
            kpp: companyData.kpp || '',
            ogrn: companyData.ogrn || '',
            address: companyData.address || '',
            management: companyData.management || '',
            okved: companyData.okved || '',
          })
        }
      } catch (fnsError: any) {
        console.warn('FNS API failed:', fnsError.message)
      }
    }

    // Если ничего не сработало
    return NextResponse.json(
      { error: 'Компания с таким ИНН не найдена' },
      { status: 404 }
    )
  } catch (error: any) {
    console.error('Error fetching company by INN:', error)
    return NextResponse.json(
      { error: 'Ошибка при поиске компании' },
      { status: 500 }
    )
  }
}

