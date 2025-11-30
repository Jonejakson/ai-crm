import crypto from 'crypto'

// Ключ шифрования из переменных окружения
// Если не указан, генерируется случайный (но это небезопасно для продакшена!)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 16 bytes для IV
const SALT_LENGTH = 64 // 64 bytes для salt
const TAG_LENGTH = 16 // 16 bytes для GCM tag
const KEY_LENGTH = 32 // 32 bytes для AES-256

/**
 * Получает ключ шифрования из ENCRYPTION_KEY
 * Если ключ не установлен, выдает предупреждение
 */
function getEncryptionKey(): Buffer {
  if (!process.env.ENCRYPTION_KEY) {
    console.warn(
      '⚠️  ENCRYPTION_KEY не установлен в переменных окружения! ' +
      'Используется случайный ключ. Это небезопасно для продакшена! ' +
      'Установите ENCRYPTION_KEY в .env файле.'
    )
  }

  // Если ключ в hex формате, конвертируем в Buffer
  if (ENCRYPTION_KEY.length === 64) {
    return Buffer.from(ENCRYPTION_KEY, 'hex')
  }

  // Иначе используем PBKDF2 для получения ключа из строки
  return crypto.pbkdf2Sync(ENCRYPTION_KEY, 'crm-salt', 100000, KEY_LENGTH, 'sha512')
}

/**
 * Шифрует строку с использованием AES-256-GCM
 * @param text - Текст для шифрования
 * @returns Зашифрованная строка в формате: iv:salt:tag:encryptedData (все в base64)
 */
export function encrypt(text: string): string {
  if (!text) {
    return ''
  }

  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const salt = crypto.randomBytes(SALT_LENGTH)

    // Создаем cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    // Шифруем данные
    let encrypted = cipher.update(text, 'utf8', 'base64')
    encrypted += cipher.final('base64')

    // Получаем auth tag
    const tag = cipher.getAuthTag()

    // Объединяем все части: iv:salt:tag:encryptedData
    return [
      iv.toString('base64'),
      salt.toString('base64'),
      tag.toString('base64'),
      encrypted,
    ].join(':')
  } catch (error) {
    console.error('[encryption] Error encrypting:', error)
    throw new Error('Ошибка шифрования данных')
  }
}

/**
 * Расшифровывает строку, зашифрованную с помощью encrypt()
 * @param encryptedText - Зашифрованная строка в формате: iv:salt:tag:encryptedData
 * @returns Расшифрованный текст
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    return ''
  }

  try {
    // Проверяем, что это зашифрованная строка (содержит разделители)
    if (!encryptedText.includes(':')) {
      // Если нет разделителей, возможно это старый формат (незашифрованные данные)
      // Возвращаем как есть для обратной совместимости
      console.warn('[encryption] Данные не зашифрованы, возвращаем как есть')
      return encryptedText
    }

    const parts = encryptedText.split(':')
    if (parts.length !== 4) {
      throw new Error('Неверный формат зашифрованных данных')
    }

    const [ivBase64, saltBase64, tagBase64, encrypted] = parts

    const key = getEncryptionKey()
    const iv = Buffer.from(ivBase64, 'base64')
    const tag = Buffer.from(tagBase64, 'base64')

    // Создаем decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    // Расшифровываем данные
    let decrypted = decipher.update(encrypted, 'base64', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.error('[encryption] Error decrypting:', error)
    // Если не удалось расшифровать, возможно это старые незашифрованные данные
    // Возвращаем как есть для обратной совместимости
    return encryptedText
  }
}

/**
 * Шифрует пароль (специальная функция для паролей)
 * В отличие от обычного encrypt(), эта функция всегда возвращает зашифрованное значение
 */
export function encryptPassword(password: string): string {
  if (!password) {
    return ''
  }
  return encrypt(password)
}

/**
 * Расшифровывает пароль
 */
export function decryptPassword(encryptedPassword: string): string {
  if (!encryptedPassword) {
    return ''
  }
  return decrypt(encryptedPassword)
}

/**
 * Проверяет, зашифрована ли строка
 */
export function isEncrypted(text: string): boolean {
  if (!text) {
    return false
  }
  // Зашифрованная строка должна содержать 4 части, разделенные двоеточиями
  return text.includes(':') && text.split(':').length === 4
}

