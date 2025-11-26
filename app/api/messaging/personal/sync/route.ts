import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * Webhook для синхронизации сообщений из личных аккаунтов
 * POST /api/messaging/personal/sync
 * Вызывается внешним сервисом синхронизации
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { accountId, platform, messages } = body;

    if (!accountId || !platform || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "accountId, platform, and messages array are required" },
        { status: 400 }
      );
    }

    // Получаем аккаунт
    const account = await prisma.userMessagingAccount.findUnique({
      where: { id: accountId },
      include: {
        user: true,
      },
    });

    if (!account || !account.isActive) {
      return NextResponse.json(
        { error: "Account not found or inactive" },
        { status: 404 }
      );
    }

    const syncedMessages = [];

    // Обрабатываем каждое сообщение
    for (const msg of messages) {
      const { chatId, phone, message, sender, timestamp, messageId } = msg;

      // Ищем или создаем контакт
      let contact = null;

      if (platform === 'TELEGRAM') {
        // Ищем по telegramChatId или phone
        contact = await prisma.contact.findFirst({
          where: {
            OR: [
              { telegramChatId: chatId?.toString() },
              { phone: phone || undefined },
            ],
            userId: account.userId,
          },
        });

        if (!contact && phone) {
          // Создаем новый контакт
          contact = await prisma.contact.create({
            data: {
              name: sender?.name || phone || 'Неизвестный',
              phone: phone || null,
              telegramChatId: chatId?.toString() || null,
              userId: account.userId,
            },
          });
        } else if (contact && chatId && !contact.telegramChatId) {
          // Обновляем chatId если его нет
          await prisma.contact.update({
            where: { id: contact.id },
            data: { telegramChatId: chatId.toString() },
          });
        }
      } else if (platform === 'WHATSAPP') {
        // Ищем по телефону
        contact = await prisma.contact.findFirst({
          where: {
            phone: phone,
            userId: account.userId,
          },
        });

        if (!contact && phone) {
          contact = await prisma.contact.create({
            data: {
              name: sender?.name || phone || 'Неизвестный',
              phone: phone,
              whatsappId: messageId?.toString() || null,
              userId: account.userId,
            },
          });
        }
      }

      if (!contact) {
        console.warn(`Could not find or create contact for message: ${messageId}`);
        continue;
      }

      // Проверяем, не сохранили ли мы уже это сообщение
      const existing = await prisma.dialog.findFirst({
        where: {
          externalId: messageId?.toString(),
          platform: platform as 'TELEGRAM' | 'WHATSAPP',
        },
      });

      if (existing) {
        continue; // Уже синхронизировано
      }

      // Сохраняем сообщение
      const dialog = await prisma.dialog.create({
        data: {
          message: message,
          sender: sender?.isUser ? 'user' : 'contact',
          platform: platform as 'TELEGRAM' | 'WHATSAPP',
          externalId: messageId?.toString(),
          contactId: contact.id,
          createdAt: timestamp ? new Date(timestamp) : new Date(),
        },
      });

      syncedMessages.push(dialog);
    }

    // Обновляем время последней синхронизации
    await prisma.userMessagingAccount.update({
      where: { id: accountId },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      synced: syncedMessages.length,
      messages: syncedMessages,
    });
  } catch (error: any) {
    console.error('Error syncing messages:', error);
    return NextResponse.json(
      {
        error: process.env.NODE_ENV === 'development' 
          ? error.message 
          : 'Internal server error'
      },
      { status: 500 }
    );
  }
}


