import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";

/**
 * Webhook для приема сообщений от Telegram
 * POST /api/messaging/telegram/webhook
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Telegram отправляет обновления в формате { message: {...}, update_id: ... }
    // Нас интересует поле message
    const message = body.message;
    
    if (!message) {
      // Это может быть другое обновление (callback_query, edited_message и т.д.)
      return NextResponse.json({ ok: true, message: "Not a message update" });
    }

    const chatId = message.chat?.id;
    const text = message.text;
    const from = message.from;
    
    if (!chatId || !text || !from) {
      return NextResponse.json({ ok: true, message: "Invalid message format" });
    }

    // Ищем интеграцию Telegram для всех компаний (так как webhook может быть общим)
    // В реальном приложении лучше использовать webhookSecret для идентификации компании
    const integrations = await prisma.messagingIntegration.findMany({
      where: {
        platform: 'TELEGRAM',
        isActive: true,
      },
      include: {
        company: true,
      },
    });

    if (integrations.length === 0) {
      console.warn('No active Telegram integrations found');
      return NextResponse.json({ ok: true, message: "No active integrations" });
    }

    // Для простоты берем первую активную интеграцию
    // В будущем можно добавить логику определения компании по chatId или другим параметрам
    const integration = integrations[0];

    // Получаем пользователей компании
    const companyUsers = await prisma.user.findMany({
      where: { companyId: integration.companyId },
    });

    if (companyUsers.length === 0) {
      console.error('No users found in company');
      return NextResponse.json({ ok: false, error: "No users in company" }, { status: 500 });
    }

    const companyUserIds = companyUsers.map(u => u.id);

    // Ищем контакт по телефону или создаем новый
    // Telegram username может быть в формате @username или phone может быть в from.phone_number
    const telegramUsername = from.username ? `@${from.username}` : null;
    const phoneNumber = from.phone_number || null;
    const contactName = `${from.first_name || ''} ${from.last_name || ''}`.trim() || 'Неизвестный';

    let contact = null;

    // Пытаемся найти контакт по телефону или создать новый
    if (phoneNumber) {
      contact = await prisma.contact.findFirst({
        where: {
          phone: phoneNumber,
          userId: {
            in: companyUserIds,
          },
        },
      });
    }

    // Если не нашли по телефону, ищем по имени (если есть telegram username)
    if (!contact && telegramUsername) {
      // Можно добавить поле telegramUsername в Contact, но пока используем поиск по имени
      contact = await prisma.contact.findFirst({
        where: {
          name: {
            contains: from.first_name || '',
          },
          userId: {
            in: companyUserIds,
          },
        },
      });
    }

    // Если контакт не найден, создаем новый
    if (!contact) {

      // Назначаем контакт первому пользователю компании (можно улучшить логику)
      const firstUser = companyUsers[0];

      contact = await prisma.contact.create({
        data: {
          name: contactName,
          phone: phoneNumber,
          telegramChatId: chatId.toString(),
          userId: firstUser.id,
        },
      });
    } else {
      // Обновляем chatId, если его еще нет
      if (!contact.telegramChatId) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { telegramChatId: chatId.toString() },
        });
      }
    }

    // Сохраняем сообщение в диалог
    await prisma.dialog.create({
      data: {
        message: text,
        sender: 'contact', // Сообщение от клиента
        platform: 'TELEGRAM',
        externalId: message.message_id?.toString(),
        contactId: contact.id,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error processing Telegram webhook:', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET метод для верификации webhook (Telegram требует это)
 */
export async function GET(req: Request) {
  return NextResponse.json({ 
    message: 'Telegram webhook endpoint',
    method: 'Use POST to receive messages'
  });
}

