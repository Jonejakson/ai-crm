import { NextResponse } from 'next/server'
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption'

/**
 * Тестовый endpoint для проверки работы шифрования
 * Проверяет, что ENCRYPTION_KEY установлен и работает корректно
 * 
 * GET /api/health/encryption
 */
export async function GET() {
  try {
    // Проверяем, что ENCRYPTION_KEY установлен
    const hasEncryptionKey = !!process.env.ENCRYPTION_KEY
    
    if (!hasEncryptionKey) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'ENCRYPTION_KEY не установлен в переменных окружения',
          hasKey: false,
          environment: process.env.NODE_ENV || 'unknown',
        },
        { status: 500 }
      )
    }

    // Тестируем шифрование/дешифрование
    const testData = 'test-data-' + Date.now()
    
    try {
      // Шифруем
      const encrypted = encrypt(testData)
      
      // Проверяем, что данные зашифрованы
      const isDataEncrypted = isEncrypted(encrypted)
      
      if (!isDataEncrypted) {
        return NextResponse.json(
          {
            status: 'error',
            message: 'Данные не были зашифрованы',
            hasKey: true,
            encrypted: false,
          },
          { status: 500 }
        )
      }

      // Расшифровываем
      const decrypted = decrypt(encrypted)
      
      // Проверяем, что данные совпадают
      if (decrypted !== testData) {
        return NextResponse.json(
          {
            status: 'error',
            message: 'Ошибка расшифровки: данные не совпадают',
            hasKey: true,
            encrypted: true,
            decrypted: false,
          },
          { status: 500 }
        )
      }

      // Все проверки пройдены
      return NextResponse.json({
        status: 'success',
        message: 'Шифрование работает корректно',
        hasKey: true,
        encrypted: true,
        decrypted: true,
        keyLength: process.env.ENCRYPTION_KEY?.length || 0,
        keyFormat: process.env.ENCRYPTION_KEY?.length === 64 ? 'hex' : 'custom',
        environment: process.env.NODE_ENV || 'unknown',
      })
    } catch (encryptionError: any) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Ошибка при тестировании шифрования: ' + encryptionError.message,
          hasKey: true,
          error: encryptionError.message,
          stack: process.env.NODE_ENV === 'development' ? encryptionError.stack : undefined,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Неожиданная ошибка: ' + error.message,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

