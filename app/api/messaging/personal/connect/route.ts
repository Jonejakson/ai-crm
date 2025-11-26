import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, getUserId } from "@/lib/get-session";

/**
 * Подключение личного аккаунта менеджера к мессенджеру
 * POST /api/messaging/personal/connect
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = getUserId(user);
    if (!userId) {
      console.error('Invalid user ID in POST:', { user, userId });
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { platform, phone, telegramApiId, telegramApiHash, code } = body;

    if (!platform || !['TELEGRAM', 'WHATSAPP'].includes(platform)) {
      return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
    }

    // Для Telegram нужны API ID и Hash
    if (platform === 'TELEGRAM') {
      if (!telegramApiId || !telegramApiHash) {
        return NextResponse.json(
          { error: "Telegram API ID and Hash are required" },
          { status: 400 }
        );
      }
    }

    // Для WhatsApp нужен номер телефона
    if (platform === 'WHATSAPP') {
      if (!phone) {
        return NextResponse.json(
          { error: "Phone number is required for WhatsApp" },
          { status: 400 }
        );
      }
    }

    // Проверяем, есть ли уже подключение
    let existing;
    try {
      existing = await prisma.userMessagingAccount.findUnique({
        where: {
          userId_platform: {
            userId: userId,
            platform: platform as 'TELEGRAM' | 'WHATSAPP',
          },
        },
      });
    } catch (prismaError: any) {
      // Если таблица не существует, возвращаем ошибку с инструкцией
      if (prismaError.code === 'P2021' || prismaError.message?.includes('does not exist')) {
        console.error('UserMessagingAccount table does not exist. Migration needed.');
        return NextResponse.json(
          { 
            error: "Database migration required. Please run: npx prisma migrate deploy",
            code: "MIGRATION_REQUIRED"
          },
          { status: 503 }
        );
      }
      throw prismaError; // Пробрасываем другие ошибки дальше
    }

    if (existing && existing.isActive) {
      return NextResponse.json(
        { error: "Account already connected" },
        { status: 400 }
      );
    }

    // Создаем или обновляем подключение
    let account;
    try {
      account = await prisma.userMessagingAccount.upsert({
        where: {
          userId_platform: {
            userId: userId,
            platform: platform as 'TELEGRAM' | 'WHATSAPP',
          },
        },
        update: {
          phone: phone || undefined,
          telegramApiId: telegramApiId || undefined,
          telegramApiHash: telegramApiHash || undefined,
          isActive: false, // Активируется после успешной авторизации
          updatedAt: new Date(),
        },
        create: {
          platform: platform as 'TELEGRAM' | 'WHATSAPP',
          phone: phone || null,
          telegramApiId: telegramApiId || null,
          telegramApiHash: telegramApiHash || null,
          isActive: false,
          userId: userId,
        },
      });
    } catch (prismaError: any) {
      // Если таблица не существует, возвращаем ошибку с инструкцией
      if (prismaError.code === 'P2021' || prismaError.message?.includes('does not exist')) {
        console.error('UserMessagingAccount table does not exist. Migration needed.');
        return NextResponse.json(
          { 
            error: "Database migration required. Please run: npx prisma migrate deploy",
            code: "MIGRATION_REQUIRED"
          },
          { status: 503 }
        );
      }
      throw prismaError; // Пробрасываем другие ошибки дальше
    }

    // Если передан код подтверждения, пытаемся завершить авторизацию
    if (code && platform === 'TELEGRAM') {
      // Здесь должна быть логика авторизации через Telegram Client API
      // Для этого нужна библиотека типа telegram или Python сервис с Telethon
      // Пока возвращаем инструкции
      return NextResponse.json({
        account,
        message: "Code received. Authorization will be completed via external service.",
        nextStep: "Use the sync service to complete authorization",
      });
    }

    // Если это Telegram и есть номер телефона, API ID и Hash, но нет кода - отправляем код
    if (platform === 'TELEGRAM' && phone && telegramApiId && telegramApiHash && !code) {
      // Проверяем, был ли уже отправлен код (есть ли phoneCodeHash в настройках)
      const existingSettings = account.settings as any;
      if (existingSettings?.phoneCodeHash) {
        // Код уже был отправлен, просто возвращаем информацию что нужно ввести код
        return NextResponse.json({
          account,
          message: "Send verification code to complete connection",
          requiresCode: true,
          codeAlreadySent: true,
        });
      }

      try {
        console.log('Starting Telegram code sending process...', {
          phone: phone?.substring(0, 3) + '***',
          hasApiId: !!telegramApiId,
          hasApiHash: !!telegramApiHash,
        });

        // Импортируем библиотеку для работы с Telegram Client API
        const { TelegramClient } = await import('telegram');
        const { StringSession } = await import('telegram/sessions');
        const { Api } = await import('telegram/tl');

        console.log('Telegram libraries imported successfully');

        // Создаем сессию (пока пустую, так как еще не авторизованы)
        const session = new StringSession('');

        // Создаем клиент Telegram
        const client = new TelegramClient(session, parseInt(telegramApiId), telegramApiHash, {
          connectionRetries: 5,
        });

        console.log('Telegram client created');

        // Подключаемся к Telegram
        console.log('Connecting to Telegram...');
        await client.connect();
        console.log('Connected to Telegram successfully');

        // Отправляем запрос на получение кода
        console.log('Sending code request to Telegram...');
        const result = await client.invoke(
          new Api.auth.SendCode({
            phoneNumber: phone,
            apiId: parseInt(telegramApiId),
            apiHash: telegramApiHash,
            settings: new Api.CodeSettings({
              allowFlashcall: false,
              currentNumber: false,
              allowAppHash: false,
            }),
          })
        );

        console.log('Telegram response received:', {
          resultType: result?.constructor?.name,
          hasPhoneCodeHash: 'phoneCodeHash' in (result as any),
          resultKeys: Object.keys(result as any),
        });

        // Получаем phoneCodeHash из результата
        // Результат может быть типа SentCode или SentCodeSuccess
        let phoneCodeHash: string;
        const resultAny = result as any;
        
        if (resultAny.phoneCodeHash && typeof resultAny.phoneCodeHash === 'string') {
          phoneCodeHash = resultAny.phoneCodeHash;
        } else if (resultAny.phone_code_hash && typeof resultAny.phone_code_hash === 'string') {
          phoneCodeHash = resultAny.phone_code_hash;
        } else {
          // Пытаемся получить из любого возможного поля
          phoneCodeHash = resultAny.phoneCodeHash || resultAny.phone_code_hash || '';
          console.warn('Phone code hash not found in expected fields, trying all fields:', {
            allKeys: Object.keys(resultAny),
            resultString: JSON.stringify(resultAny, null, 2).substring(0, 500),
          });
        }

        if (!phoneCodeHash) {
          console.error('Failed to extract phoneCodeHash. Full result:', JSON.stringify(resultAny, null, 2));
          throw new Error('Failed to get phone code hash from Telegram response. Please check your API credentials.');
        }

        console.log('Phone code hash extracted successfully:', phoneCodeHash.substring(0, 10) + '...');

        // Сохраняем phone_code_hash для последующей проверки кода
        await prisma.userMessagingAccount.update({
          where: { id: account.id },
          data: {
            settings: {
              phoneCodeHash: phoneCodeHash,
            },
          },
        });

        console.log('Phone code hash saved to database');

        // Отключаемся от клиента
        await client.disconnect();
        console.log('Disconnected from Telegram');

        return NextResponse.json({
          account,
          message: "Send verification code to complete connection",
          requiresCode: true,
          codeSent: true,
        });
      } catch (telegramError: any) {
        console.error('Error sending Telegram code:', telegramError);
        console.error('Error details:', {
          message: telegramError.message,
          stack: telegramError.stack,
          name: telegramError.name,
          code: telegramError.code,
          error: telegramError.error,
        });
        
        // Более детальное сообщение об ошибке
        let errorMessage = "Failed to send verification code";
        if (telegramError.message) {
          errorMessage = telegramError.message;
        } else if (telegramError.error) {
          errorMessage = telegramError.error;
        }

        return NextResponse.json({
          account,
          error: errorMessage,
          message: `Error sending code: ${errorMessage}. Please check your API credentials and phone number.`,
          debug: process.env.NODE_ENV === 'development' ? {
            errorType: telegramError.constructor?.name,
            errorMessage: telegramError.message,
            errorStack: telegramError.stack,
          } : undefined,
        }, { status: 400 });
      }
    }

    return NextResponse.json({
      account,
      message: platform === 'TELEGRAM' 
        ? "Send verification code to complete connection"
        : "WhatsApp connection requires additional setup",
    });
  } catch (error: any) {
    console.error('Error connecting personal account:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      name: error.name,
    });
    return NextResponse.json(
      { 
        error: process.env.NODE_ENV === 'development' 
          ? `Error: ${error.message}${error.code ? ` (Code: ${error.code})` : ''}` 
          : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET - получить подключенные аккаунты пользователя
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = getUserId(user);
    if (!userId) {
      console.error('Invalid user ID:', { user, userId });
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    try {
      const accounts = await prisma.userMessagingAccount.findMany({
        where: { userId: userId },
        orderBy: { platform: 'asc' },
      });

      // Не возвращаем чувствительные данные (API Hash, сессии)
      const safeAccounts = accounts.map(acc => ({
        id: acc.id,
        platform: acc.platform,
        isActive: acc.isActive,
        phone: acc.phone,
        lastSyncAt: acc.lastSyncAt,
        createdAt: acc.createdAt,
        updatedAt: acc.updatedAt,
      }));

      return NextResponse.json(safeAccounts);
    } catch (prismaError: any) {
      // Если таблица не существует, возвращаем пустой массив
      if (prismaError.code === 'P2021' || prismaError.message?.includes('does not exist')) {
        console.warn('UserMessagingAccount table does not exist yet, returning empty array');
        return NextResponse.json([]);
      }
      throw prismaError; // Пробрасываем другие ошибки дальше
    }
  } catch (error: any) {
    console.error('Error fetching personal accounts:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    return NextResponse.json(
      { 
        error: process.env.NODE_ENV === 'development' 
          ? `Error: ${error.message}` 
          : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}


