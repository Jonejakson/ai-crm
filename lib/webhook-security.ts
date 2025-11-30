import crypto from 'crypto'
import { decrypt } from './encryption'

/**
 * Универсальная утилита для проверки HMAC-SHA256 подписей webhook'ов
 * Использует timing-safe сравнение для защиты от timing attacks
 */

/**
 * Проверить HMAC-SHA256 подпись webhook'а
 * 
 * @param body - Тело запроса (строка или объект, который будет сериализован в JSON)
 * @param signature - Подпись из заголовка запроса
 * @param secret - Секретный ключ (может быть зашифрованным)
 * @param options - Дополнительные опции:
 *   - headerFormat: формат заголовка ('plain' | 'sha256=prefix' | 'custom')
 *   - customPrefix: кастомный префикс для формата 'custom'
 *   - isEncrypted: является ли secret зашифрованным (по умолчанию true)
 * @returns true если подпись валидна, false иначе
 */
export async function verifyWebhookSignature(
  body: string | object,
  signature: string | null,
  secret: string | null,
  options: {
    headerFormat?: 'plain' | 'sha256=prefix' | 'custom'
    customPrefix?: string
    isEncrypted?: boolean
  } = {}
): Promise<boolean> {
  try {
    // Если подпись или секрет отсутствуют, возвращаем false
    if (!signature || !secret) {
      return false
    }

    const {
      headerFormat = 'plain',
      customPrefix = '',
      isEncrypted = true,
    } = options

    // Расшифровываем секрет, если он зашифрован
    const decryptedSecret = isEncrypted ? await decrypt(secret) : secret

    // Сериализуем тело запроса в строку
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body)

    // Обрабатываем разные форматы заголовков
    let signatureToCompare: string = signature

    if (headerFormat === 'sha256=prefix') {
      // Формат: sha256=abc123... (используется YooKassa)
      const parts = signature.split('=')
      if (parts.length !== 2 || parts[0] !== 'sha256') {
        console.error('[webhook-security] Неверный формат подписи (ожидается sha256=...)')
        return false
      }
      signatureToCompare = parts[1]
    } else if (headerFormat === 'custom' && customPrefix) {
      // Формат: customPrefix=abc123...
      const parts = signature.split('=')
      if (parts.length !== 2 || parts[0] !== customPrefix) {
        console.error(`[webhook-security] Неверный формат подписи (ожидается ${customPrefix}=...)`)
        return false
      }
      signatureToCompare = parts[1]
    }
    // Для 'plain' используем подпись как есть

    // Создаем HMAC-SHA256 подпись
    const hmac = crypto.createHmac('sha256', decryptedSecret)
    hmac.update(bodyString)
    const calculatedSignature = hmac.digest('hex')

    // Сравниваем подписи безопасным способом (защита от timing attacks)
    // Используем timingSafeEqual для предотвращения timing attacks
    if (signatureToCompare.length !== calculatedSignature.length) {
      return false
    }

    return crypto.timingSafeEqual(
      Buffer.from(signatureToCompare, 'hex'),
      Buffer.from(calculatedSignature, 'hex')
    )
  } catch (error) {
    console.error('[webhook-security] Ошибка проверки подписи:', error)
    return false
  }
}

/**
 * Проверить подпись YooKassa webhook'а
 * (обертка для обратной совместимости)
 */
export function verifyYooKassaWebhookSignature(
  body: string,
  signature: string
): boolean {
  const secretKey = process.env.YOOKASSA_SECRET_KEY
  if (!secretKey) {
    console.warn('[webhook-security] YOOKASSA_SECRET_KEY не установлен')
    return process.env.NODE_ENV !== 'production'
  }

  // Используем синхронную версию для обратной совместимости
  try {
    const parts = signature.split('=')
    if (parts.length !== 2 || parts[0] !== 'sha256') {
      return false
    }

    const receivedSignature = parts[1]
    const hmac = crypto.createHmac('sha256', secretKey)
    hmac.update(body)
    const calculatedSignature = hmac.digest('hex')

    if (receivedSignature.length !== calculatedSignature.length) {
      return false
    }

    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature, 'hex'),
      Buffer.from(calculatedSignature, 'hex')
    )
  } catch (error) {
    console.error('[webhook-security] Ошибка проверки подписи YooKassa:', error)
    return false
  }
}

/**
 * Проверить подпись WhatsApp Business API webhook'а
 * WhatsApp использует формат: sha256=... в заголовке X-Hub-Signature-256
 */
export async function verifyWhatsAppWebhookSignature(
  body: string | object,
  signature: string | null,
  secret: string | null
): Promise<boolean> {
  return verifyWebhookSignature(body, signature, secret, {
    headerFormat: 'sha256=prefix',
    isEncrypted: true,
  })
}

/**
 * Проверить подпись Yandex.Direct webhook'а
 * Yandex.Direct использует простой hex формат в заголовке X-Yandex-Signature
 */
export async function verifyYandexDirectWebhookSignature(
  body: string | object,
  signature: string | null,
  secret: string | null
): Promise<boolean> {
  return verifyWebhookSignature(body, signature, secret, {
    headerFormat: 'plain',
    isEncrypted: true,
  })
}

/**
 * Проверить подпись Avito webhook'а
 * Avito использует простой hex формат в заголовке X-Avito-Signature
 */
export async function verifyAvitoWebhookSignature(
  body: string | object,
  signature: string | null,
  secret: string | null
): Promise<boolean> {
  return verifyWebhookSignature(body, signature, secret, {
    headerFormat: 'plain',
    isEncrypted: true,
  })
}

