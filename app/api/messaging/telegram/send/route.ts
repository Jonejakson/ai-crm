import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-session";

/**
 * Отправка сообщения через Telegram
 * POST /api/messaging/telegram/send
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { contactId, message } = body;

    if (!contactId || !message) {
      return NextResponse.json(
        { error: "contactId and message are required" },
        { status: 400 }
      );
    }

    // Проверяем, что контакт принадлежит пользователю
    const contact = await prisma.contact.findUnique({
      where: { id: Number(contactId) },
      include: {
        user: {
          include: {
            company: true,
          },
        },
      },
    });

    if (!contact || !contact.user) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // Проверяем доступ пользователя к контакту
    if (contact.userId !== parseInt(user.id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Ищем активную интеграцию Telegram для компании
    const integration = await prisma.messagingIntegration.findFirst({
      where: {
        companyId: contact.user.company.id,
        platform: 'TELEGRAM',
        isActive: true,
      },
    });

    if (!integration || !integration.botToken) {
      return NextResponse.json(
        { error: "Telegram integration not configured or inactive" },
        { status: 400 }
      );
    }

    // Получаем chatId контакта
    const telegramChatId = contact.telegramChatId;
    if (!telegramChatId) {
      // Если есть телефон, можно попробовать использовать его (но это не всегда работает)
      // В Telegram нельзя отправлять сообщения по номеру телефона без предварительного контакта
      return NextResponse.json(
        { 
          error: "У этого контакта нет Telegram chat ID. Попросите клиента написать боту, чтобы начать диалог.",
          hint: contact.phone 
            ? `У контакта есть телефон (${contact.phone}), но для отправки через Telegram нужно, чтобы клиент сначала написал боту.`
            : "У контакта нет телефона. Добавьте телефон и попросите клиента написать боту."
        },
        { status: 400 }
      );
    }

    // Отправляем сообщение через Telegram Bot API
    const telegramApiUrl = `https://api.telegram.org/bot${integration.botToken}/sendMessage`;
    
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: message,
      }),
    });

    const telegramResponse = await response.json();

    if (!telegramResponse.ok) {
      console.error('Telegram API error:', telegramResponse);
      return NextResponse.json(
        { 
          error: telegramResponse.description || "Failed to send message via Telegram",
          details: telegramResponse
        },
        { status: 500 }
      );
    }

    // Сохраняем сообщение в диалог
    const dialog = await prisma.dialog.create({
      data: {
        message: message,
        sender: 'user',
        platform: 'TELEGRAM',
        externalId: telegramResponse.result?.message_id?.toString(),
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
      telegramMessageId: telegramResponse.result?.message_id,
    });
  } catch (error: any) {
    console.error('Error sending Telegram message:', error);
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

