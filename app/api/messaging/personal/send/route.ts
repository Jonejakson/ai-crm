import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";

/**
 * Отправка сообщения от имени менеджера через его личный аккаунт
 * POST /api/messaging/personal/send
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { contactId, message, platform } = body;

    if (!contactId || !message || !platform) {
      return NextResponse.json(
        { error: "contactId, message, and platform are required" },
        { status: 400 }
      );
    }

    if (!['TELEGRAM', 'WHATSAPP'].includes(platform)) {
      return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
    }

    // Проверяем, что у пользователя есть активное подключение
    const account = await prisma.userMessagingAccount.findUnique({
      where: {
        userId_platform: {
          userId: parseInt(user.id),
          platform: platform as 'TELEGRAM' | 'WHATSAPP',
        },
      },
    });

    if (!account || !account.isActive) {
      return NextResponse.json(
        { 
          error: `No active ${platform} account connected. Please connect your account first.`,
          hint: "Go to settings to connect your personal messaging account"
        },
        { status: 400 }
      );
    }

    // Получаем контакт
    const contact = await prisma.contact.findUnique({
      where: { id: Number(contactId) },
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // Проверяем доступ к контакту
    if (contact.userId !== parseInt(user.id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Определяем получателя
    let recipientId: string | null = null;
    
    if (platform === 'TELEGRAM') {
      recipientId = contact.telegramChatId;
      if (!recipientId) {
        return NextResponse.json(
          { 
            error: "Contact doesn't have Telegram chat ID",
            hint: "The contact needs to send you a message first, or you need to add them to your contacts"
          },
          { status: 400 }
        );
      }
    } else if (platform === 'WHATSAPP') {
      recipientId = contact.phone;
      if (!recipientId) {
        return NextResponse.json(
          { error: "Contact doesn't have phone number" },
          { status: 400 }
        );
      }
    }

    // Здесь должна быть логика отправки через соответствующий API
    // Для Telegram - через Telegram Client API (MTProto)
    // Для WhatsApp - через WhatsApp Business API или альтернативное решение
    
    // ВРЕМЕННО: возвращаем инструкции
    // В реальной реализации здесь будет вызов сервиса отправки сообщений
    const externalServiceUrl = process.env.MESSAGING_SERVICE_URL || 'http://localhost:3001';
    
    try {
      // Вызываем внешний сервис для отправки сообщения
      const response = await fetch(`${externalServiceUrl}/api/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          accountId: account.id,
          recipientId,
          message,
          session: platform === 'TELEGRAM' ? account.telegramSession : account.whatsappSession,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return NextResponse.json(
          { 
            error: errorData.error || `Failed to send message via ${platform}`,
            details: errorData
          },
          { status: 500 }
        );
      }

      const result = await response.json();

      // Сохраняем сообщение в диалог
      const dialog = await prisma.dialog.create({
        data: {
          message: message,
          sender: 'user',
          platform: platform as 'TELEGRAM' | 'WHATSAPP',
          externalId: result.messageId?.toString(),
          contactId: contact.id,
        },
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        dialog,
        messageId: result.messageId,
      });
    } catch (serviceError: any) {
      // Если внешний сервис недоступен, возвращаем инструкции
      console.error('Messaging service error:', serviceError);
      return NextResponse.json(
        { 
          error: "Messaging service is not available",
          hint: "Please set up the messaging service or use bot integration instead",
          fallback: "You can still save the message as internal"
        },
        { status: 503 }
      );
    }
  } catch (error: any) {
    console.error('Error sending personal message:', error);
    return NextResponse.json(
      {
        error: process.env.NODE_ENV === 'development' 
          ? error.message 
          : "Internal server error"
      },
      { status: 500 }
    );
  }
}


