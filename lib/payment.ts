/**
 * Утилиты для работы с платежной системой YooKassa
 */

interface YooKassaConfig {
  shopId: string
  secretKey: string
}

let config: YooKassaConfig | null = null

export function getYooKassaConfig(): YooKassaConfig {
  if (config) {
    return config
  }

  const shopId = process.env.YOOKASSA_SHOP_ID
  const secretKey = process.env.YOOKASSA_SECRET_KEY

  if (!shopId || !secretKey) {
    throw new Error('YooKassa credentials not configured. Set YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY')
  }

  config = { shopId, secretKey }
  return config
}

export function isYooKassaConfigured(): boolean {
  try {
    getYooKassaConfig()
    return true
  } catch {
    return false
  }
}

interface CreatePaymentRequest {
  amount: {
    value: string // в формате "100.00"
    currency: string // "RUB"
  }
  description: string
  confirmation: {
    type: 'redirect'
    return_url: string
  }
  metadata?: Record<string, string>
}

interface YooKassaPayment {
  id: string
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled'
  amount: {
    value: string
    currency: string
  }
  description: string
  metadata?: Record<string, string>
  confirmation?: {
    confirmation_url: string
  }
}

/**
 * Создать платеж в YooKassa
 */
export async function createYooKassaPayment(
  amount: number,
  currency: string,
  description: string,
  returnUrl: string,
  metadata?: Record<string, string>
): Promise<YooKassaPayment> {
  const { shopId, secretKey } = getYooKassaConfig()

  const paymentRequest: CreatePaymentRequest = {
    amount: {
      value: amount.toFixed(2),
      currency: currency.toUpperCase(),
    },
    description,
    confirmation: {
      type: 'redirect',
      return_url: returnUrl,
    },
    ...(metadata && { metadata }),
  }

  const auth = Buffer.from(`${shopId}:${secretKey}`).toString('base64')

  const response = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotence-Key': `${Date.now()}-${Math.random()}`,
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(paymentRequest),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`YooKassa API error: ${response.status} - ${error}`)
  }

  return response.json()
}

/**
 * Получить информацию о платеже
 */
export async function getYooKassaPayment(paymentId: string): Promise<YooKassaPayment> {
  const { shopId, secretKey } = getYooKassaConfig()
  const auth = Buffer.from(`${shopId}:${secretKey}`).toString('base64')

  const response = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`YooKassa API error: ${response.status} - ${error}`)
  }

  return response.json()
}

/**
 * Проверить подпись webhook от YooKassa
 * YooKassa использует HMAC-SHA256 для подписи webhook'ов
 * 
 * @param body - Тело запроса (строка JSON)
 * @param signature - Подпись из заголовка X-YooMoney-Signature
 * @returns true если подпись валидна, false иначе
 */
export function verifyYooKassaWebhook(
  body: string,
  signature: string
): boolean {
  try {
    // Получаем секретный ключ из переменных окружения
    const secretKey = process.env.YOOKASSA_SECRET_KEY
    if (!secretKey) {
      console.warn('[payment] YOOKASSA_SECRET_KEY не установлен, пропускаем проверку подписи')
      // В development можно пропустить проверку, но в production это небезопасно
      return process.env.NODE_ENV !== 'production'
    }

    // YooKassa использует HMAC-SHA256
    // Формат подписи: <algorithm>=<signature>
    // Например: sha256=abc123...
    const parts = signature.split('=')
    if (parts.length !== 2 || parts[0] !== 'sha256') {
      console.error('[payment] Неверный формат подписи YooKassa')
      return false
    }

    const receivedSignature = parts[1]

    // Создаем HMAC-SHA256 подпись
    const crypto = require('crypto')
    const hmac = crypto.createHmac('sha256', secretKey)
    hmac.update(body)
    const calculatedSignature = hmac.digest('hex')

    // Сравниваем подписи безопасным способом (защита от timing attacks)
    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature, 'hex'),
      Buffer.from(calculatedSignature, 'hex')
    )
  } catch (error) {
    console.error('[payment] Ошибка проверки подписи YooKassa:', error)
    return false
  }
}

