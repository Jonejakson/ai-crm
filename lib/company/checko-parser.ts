/**
 * Парсер для получения данных о компании по ИНН с сайта checko.ru
 * Альтернатива daData API - бесплатный парсинг данных
 */

export interface CompanyData {
  name: string
  inn: string
  kpp?: string
  ogrn?: string
  address?: string
  management?: string
  okved?: string
}

/**
 * Декодирует HTML-сущности в текст
 */
function decodeHtmlEntities(text: string): string {
  // Сначала декодируем числовые HTML-сущности (&#34;, &#39; и т.д.)
  let decoded = text.replace(/&#(\d+);/g, (match, code) => {
    return String.fromCharCode(parseInt(code, 10))
  })
  
  // Затем декодируем именованные HTML-сущности
  const entityMap: Record<string, string> = {
    '&quot;': '"',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&apos;': "'",
    '&#39;': "'",
    '&nbsp;': ' ',
    '&laquo;': '«',
    '&raquo;': '»',
  }
  
  decoded = decoded.replace(/&[#\w]+;/g, (entity) => {
    return entityMap[entity] || entity
  })
  
  return decoded
}

/**
 * Парсит HTML страницы checko.ru и извлекает данные о компании
 */
function parseCheckoHtml(html: string, inn: string): CompanyData | null {
  try {
    // Очистка HTML от лишних пробелов и переносов строк
    const cleanHtml = html.replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ')
    
    // Название компании - пробуем разные варианты
    let name = ''
    
    // Вариант 1: из заголовка h1
    const h1Match = cleanHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    if (h1Match) {
      name = h1Match[1].trim()
    }
    
    // Вариант 2: из title (убираем лишнее)
    if (!name) {
      const titleMatch = cleanHtml.match(/<title>([^<]+)<\/title>/i)
      if (titleMatch) {
        name = titleMatch[1]
          .replace(/[-–—]\s*Checko\.ru.*$/i, '')
          .replace(/\s*-\s*Checko.*$/i, '')
          .trim()
      }
    }
    
    // Вариант 3: из JSON-LD структурированных данных
    if (!name) {
      const jsonLdMatch = cleanHtml.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([^<]+)<\/script>/i)
      if (jsonLdMatch) {
        try {
          const jsonLd = JSON.parse(jsonLdMatch[1])
          if (jsonLd.name) {
            name = jsonLd.name
          } else if (jsonLd['@graph'] && Array.isArray(jsonLd['@graph'])) {
            const org = jsonLd['@graph'].find((item: any) => item['@type'] === 'Organization')
            if (org && org.name) {
              name = org.name
            }
          }
        } catch (e) {
          // Игнорируем ошибки парсинга JSON
        }
      }
    }
    
    // Вариант 4: из мета-тегов
    if (!name) {
      const metaNameMatch = cleanHtml.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                           cleanHtml.match(/<meta[^>]*name=["']title["'][^>]*content=["']([^"']+)["']/i)
      if (metaNameMatch) {
        name = metaNameMatch[1].trim()
      }
    }

    if (!name) {
      return null
    }

    // ИНН - ищем в тексте
    const innMatch = cleanHtml.match(/ИНН[:\s]*(\d{10,12})/i) || 
                     cleanHtml.match(/inn[:\s]*(\d{10,12})/i)
    const foundInn = innMatch ? innMatch[1] : inn

    // КПП
    const kppMatch = cleanHtml.match(/КПП[:\s]*(\d{9})/i) ||
                     cleanHtml.match(/kpp[:\s]*(\d{9})/i)
    const kpp = kppMatch ? kppMatch[1] : undefined

    // ОГРН
    const ogrnMatch = cleanHtml.match(/ОГРН[:\s]*(\d{13,15})/i) ||
                      cleanHtml.match(/ogrn[:\s]*(\d{13,15})/i)
    const ogrn = ogrnMatch ? ogrnMatch[1] : undefined

    // Адрес - ищем более широко
    let address: string | undefined
    const addressPatterns = [
      /Юридический\s+адрес[:\s]*([^<\n]+)/i,
      /Адрес[:\s]*([^<\n]+)/i,
      /<div[^>]*class="[^"]*address[^"]*"[^>]*>([^<]+)<\/div>/i,
      /<span[^>]*>Адрес[^<]*<\/span>[^<]*<span[^>]*>([^<]+)<\/span>/i,
    ]
    
    for (const pattern of addressPatterns) {
      const match = cleanHtml.match(pattern)
      if (match && match[1]) {
        address = match[1].trim()
        // Ограничиваем длину адреса (убираем лишнее)
        if (address.length > 200) {
          address = address.substring(0, 200).trim()
        }
        break
      }
    }

    // Руководитель
    let management: string | undefined
    const managementPatterns = [
      /Руководитель[:\s]*([^<\n]+)/i,
      /Генеральный\s+директор[:\s]*([^<\n]+)/i,
      /Директор[:\s]*([^<\n]+)/i,
      /<div[^>]*class="[^"]*director[^"]*"[^>]*>([^<]+)<\/div>/i,
    ]
    
    for (const pattern of managementPatterns) {
      const match = cleanHtml.match(pattern)
      if (match && match[1]) {
        management = match[1].trim()
        // Ограничиваем длину (убираем лишнее после имени)
        if (management.length > 100) {
          management = management.substring(0, 100).trim()
        }
        break
      }
    }

    // ОКВЭД
    const okvedMatch = cleanHtml.match(/ОКВЭД[:\s]*([\d.]+)/i) ||
                       cleanHtml.match(/okved[:\s]*([\d.]+)/i)
    const okved = okvedMatch ? okvedMatch[1] : undefined

    // Декодируем HTML-сущности в названии и других полях
    const decodedName = decodeHtmlEntities(name.trim())
    const decodedAddress = address ? decodeHtmlEntities(address) : undefined
    const decodedManagement = management ? decodeHtmlEntities(management) : undefined

    return {
      name: decodedName,
      inn: foundInn,
      kpp,
      ogrn,
      address: decodedAddress,
      management: decodedManagement,
      okved,
    }
  } catch (error) {
    console.error('Error parsing checko HTML:', error)
    return null
  }
}

/**
 * Получает данные о компании по ИНН с checko.ru
 */
export async function fetchCompanyByInnFromChecko(inn: string): Promise<CompanyData | null> {
  const cleanInn = inn.replace(/\D/g, '')
  
  if (cleanInn.length !== 10 && cleanInn.length !== 12) {
    throw new Error('ИНН должен содержать 10 или 12 цифр')
  }

  try {
    // Пробуем несколько вариантов URL checko.ru
    const urls = [
      `https://checko.ru/company/${cleanInn}`,
      `https://www.checko.ru/company/${cleanInn}`,
      `https://checko.ru/search?query=${cleanInn}`,
    ]

    let lastError: Error | null = null

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          },
          // Таймаут 10 секунд
          signal: AbortSignal.timeout(10000),
        })

        if (!response.ok) {
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
          continue
        }

        const html = await response.text()
        const companyData = parseCheckoHtml(html, cleanInn)

        if (companyData) {
          return companyData
        }
      } catch (error: any) {
        lastError = error
        console.warn(`Failed to fetch from ${url}:`, error.message)
        continue
      }
    }

    // Если все URL не сработали, пробуем альтернативный источник - API ФНС
    // Это бесплатный официальный API, но требует регистрации
    // Пока возвращаем null, можно добавить позже
    if (lastError) {
      throw lastError
    }

    return null
  } catch (error: any) {
    console.error('Error fetching company from checko:', error)
    throw error
  }
}

/**
 * Альтернативный метод через API ФНС (если checko не работает)
 * Требует регистрации на api-fns.ru
 */
export async function fetchCompanyByInnFromFns(inn: string, apiKey?: string): Promise<CompanyData | null> {
  if (!apiKey) {
    return null
  }

  try {
    const response = await fetch(`https://api-fns.ru/api/inn?inn=${inn}&key=${apiKey}`)
    
    if (!response.ok) {
      return null
    }

    const data = await response.json()
    
    if (data.Требование || !data.ИП && !data.ЮЛ) {
      return null
    }

    const company = data.ИП || data.ЮЛ

    return {
      name: company.НаимСокрЮЛ || company.НаимПолнЮЛ || company.ФИОПолн || '',
      inn: inn,
      kpp: company.КПП,
      ogrn: company.ОГРН || company.ОГРНИП,
      address: company.АдресПолн,
      management: company.Руководитель?.ФИОПолн,
      okved: company.ОсновнойОКВЭД?.Код,
    }
  } catch (error) {
    console.error('Error fetching from FNS API:', error)
    return null
  }
}

