import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";

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

    const body = await req.json();
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
    const existing = await prisma.userMessagingAccount.findUnique({
      where: {
        userId_platform: {
          userId: parseInt(user.id),
          platform: platform as 'TELEGRAM' | 'WHATSAPP',
        },
      },
    });

    if (existing && existing.isActive) {
      return NextResponse.json(
        { error: "Account already connected" },
        { status: 400 }
      );
    }

    // Создаем или обновляем подключение
    const account = await prisma.userMessagingAccount.upsert({
      where: {
        userId_platform: {
          userId: parseInt(user.id),
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
        userId: parseInt(user.id),
      },
    });

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

    return NextResponse.json({
      account,
      message: platform === 'TELEGRAM' 
        ? "Send verification code to complete connection"
        : "WhatsApp connection requires additional setup",
    });
  } catch (error: any) {
    console.error('Error connecting personal account:', error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' },
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

    const accounts = await prisma.userMessagingAccount.findMany({
      where: { userId: parseInt(user.id) },
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
  } catch (error: any) {
    console.error('Error fetching personal accounts:', error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}


